require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const supabase = require('./db');
const { initScheduler } = require('./scheduler');

const ADMIN_NUMBER = process.env.ADMIN_NUMBER; // Format: 'COUNTRYCODE_NUMBER' (e.g. '1234567890')

async function connectToWhatsApp() {
    console.log('🔌 Initializing WhatsApp connection...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`🌍 Using WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Safari')
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📲 QR Code received! Please scan with your WhatsApp.\n');
            qrcode.generate(qr, { small: true });
            console.log('\n🔗 IF THE TERMINAL QR CODE IS DISTORTED, CLICK OR COPY THIS LINK TO YOUR BROWSER TO SCAN A CLEAR ONE:');
            console.log(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(qr)}\n`);
            
            // Sync to Supabase for the UI Dashboard Live View!
            supabase.from('settings').update({ qr_code: qr, connection_status: 'pairing' }).eq('id', 1).then(() => {
                console.log('✅ QR Code synced to Dashboard UI!');
            }).catch(e => console.error('Supabase QR Sync Failed:', e.message));
        }

        if(connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
            
            supabase.from('settings').update({ connection_status: 'disconnected' }).eq('id', 1).catch(()=>{});

            if (lastDisconnect?.error) {
                console.error('Disconnect Reason:', lastDisconnect.error.message || lastDisconnect.error);
            }
            if(shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            } else {
                console.log('❌ Logged out. Please delete the auth_info_baileys folder and restart.');
            }
        } else if(connection === 'open') {
            console.log('✅ Connected to WhatsApp successfully!');
            
            supabase.from('settings').update({ connection_status: 'connected', qr_code: null }).eq('id', 1).catch(()=>{});

            // Start the cron scheduler now that WhatsApp is ready
            initScheduler(sock);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Reply listener, Memory & Admin notification
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const contactPhone = sender.split('@')[0];
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

        if (text) {
            console.log(`💬 Received message from ${contactPhone}: ${text}`);
            const { getNotificationSetting, getContactPersona } = require('./db');
            const { saveMessage, generateContextualReply } = require('./memory');

            // Save incoming message to chat history
            await saveMessage(contactPhone, 'user', text);

            const notificationsEnabled = await getNotificationSetting();
            
            if (notificationsEnabled && ADMIN_NUMBER && !sender.includes(ADMIN_NUMBER)) {
                try {
                    const adminJid = `${ADMIN_NUMBER}@s.whatsapp.net`;
                    const notifyText = `🚨 *Agent Notification*\nReply from: ${contactPhone}\nMessage: "${text}"`;
                    await sock.sendMessage(adminJid, { text: notifyText });
                    console.log(`✅ Forwarded reply to Admin (${ADMIN_NUMBER})`);
                } catch (e) {
                    console.error('Failed to forward reply to Admin', e);
                }
            }
        }
    });
}

connectToWhatsApp();
