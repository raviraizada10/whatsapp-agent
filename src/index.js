require('dotenv').config();
const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { supabase } = require('./db');
const { initScheduler, activeJobs } = require('./scheduler');
const { startWebhookServer, setWebhookGlobals } = require('./webhook');

const ADMIN_NUMBER = process.env.ADMIN_NUMBER; // Format: 'COUNTRYCODE_NUMBER' (e.g. '1234567890')

// START WEBHOOK SERVER IMMEDIATELY TO SATISFY RENDER PORT BINDING RULE
try {
    startWebhookServer();
} catch (e) {
    console.error('❌ Failed to start Webhook server:', e.message);
}

// Global Exception Handlers for Production Stability
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err);
    // In production, we might want to exit and let Render restart us
    if (err.message.includes('EADDRINUSE')) process.exit(1);
});

async function connectToWhatsApp() {
    console.log('🔌 Initializing WhatsApp connection (Supabase-backed)...');
    const { useSupabaseAuthState } = require('./auth');
    const { state, saveCreds, clearAuth } = await useSupabaseAuthState(supabase);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`🌍 Using WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);
    
    const sessionName = process.env.SESSION_NAME || 'Safari';
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS(sessionName)
    });

    sock.ev.on('connection.update', async (update) => {
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
            
            supabase.from('settings').update({ connection_status: 'disconnected' }).eq('id', 1).then(()=>{}).catch(()=>{});

            if (lastDisconnect?.error) {
                const errMsg = lastDisconnect.error.message || lastDisconnect.error;
                console.error(`Disconnect Reason: ${errMsg}`);
                if (errMsg.includes('conflict')) {
                    console.error('🚨 AGENT CONFLICT: Another instance of this bot is running with the same session name.');
                    console.error('🚨 Please CLOSE all other terminal windows or Render environments to ensure only ONE Jarvis is live.');
                }
            }
            if(shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            } else {
                console.log('❌ Logged out. Automatically resetting Supabase session data to generate NEW QR...');
                try {
                    if (clearAuth) await clearAuth();
                    console.log('✅ Session data cleared from Supabase. Re-initializing for new scan.');
                    setTimeout(connectToWhatsApp, 2000);
                } catch (err) {
                    console.error('Failed to auto-clear session data:', err.message);
                }
            }
        } else if(connection === 'open') {
            console.log('✅ Connected to WhatsApp successfully!');
            
            supabase.from('settings').update({ connection_status: 'connected', qr_code: null }).eq('id', 1).then(()=>{}).catch(()=>{});

            // Start the cron scheduler now that WhatsApp is ready
            initScheduler(sock);
            // Provide the webhooks the live sockets to broadcast messages
            setWebhookGlobals(activeJobs, sock);

            // 5-minute Heartbeat for Dashboard visibility & Keep-Alive
            setInterval(async () => {
                try {
                    console.log('💓 Heartbeat: Updating Dashboard status...');
                    await supabase.from('settings').update({ 
                        last_heartbeat: new Date().toISOString(),
                        connection_status: 'connected' 
                    }).eq('id', 1);

                    // Optional Self-Ping if URL is provided
                    const selfPingUrl = process.env.SELF_PING_URL;
                    if (selfPingUrl) {
                        const axios = require('axios');
                        await axios.get(selfPingUrl).catch(() => {});
                    }
                } catch (err) {
                    console.error('Heartbeat update failed:', err.message);
                }
            }, 5 * 60 * 1000);

            // 5-minute Proactive Calendar Reminder Check
            setInterval(async () => {
                const { getImminentEvents } = require('./calendar');
                if (!ADMIN_NUMBER) return;
                
                try {
                    const events = await getImminentEvents(15);
                    if (events && events.length > 0) {
                        for (const event of events) {
                            const adminJid = `${ADMIN_NUMBER}@s.whatsapp.net`;
                            const timeStr = new Date(event.start.dateTime || event.start.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                            const msg = `📅 *Reminder:* Your event "${event.summary}" is starting soon at ${timeStr}.`;
                            await sock.sendMessage(adminJid, { text: msg });
                            console.log(`✅ Sent proactive calendar reminder for: ${event.summary}`);
                        }
                    }
                } catch (e) {
                    console.error('Proactive calendar check failed:', e.message);
                }
            }, 5 * 60 * 1000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Reply listener, Memory & Admin notification
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        
        // Prevent infinite loops!
        // We ignore all messages sent by ourselves (fromMe = true)
        // EXCEPT if the Admin is explicitly chatting with the bot using the "/agent" command
        if (msg.key.fromMe) {
            if (!text || !text.toLowerCase().startsWith('/agent')) {
                return;
            }
        }

        const sender = msg.key.remoteJid;
        const contactPhone = sender.split('@')[0];

        if (text) {
            console.log(`💬 Received message from ${contactPhone}: ${text}`);
            const { getNotificationSetting, getContactPersona } = require('./db');
            const { saveMessage } = require('./memory');
            const { generateMessage } = require('./ai');

            // Save incoming message to chat history
            await saveMessage(contactPhone, 'user', text);

            // HANDLE AGENT COMMANDS (Jarvis, /agent, etc.)
            const isJarvis = text.toLowerCase().startsWith('jarvis');
            const isAgent = text.toLowerCase().startsWith('/agent');

            if (isJarvis || isAgent) {
                // Extract constraints (remove "Jarvis," or "Jarvis " or "/agent ")
                let constraint = text;
                if (isJarvis) constraint = text.substring(6).replace(/^[,:\s]+/, '').trim();
                else if (isAgent) constraint = text.substring(7).trim();

                const persona = await getContactPersona(contactPhone);
                
                // Trigger the Agentic "Brain" (now with 'Jarvis' identity)
                const agentReply = await generateMessage('Admin', constraint || 'How can I help, sir?', persona);
                
                if (agentReply) {
                    await sock.sendMessage(sender, { text: `🤵 *Jarvis:* ${agentReply}` });
                    await saveMessage(contactPhone, 'agent', agentReply);
                }
                return;
            }

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

async function startApp() {
    try {
        const delay = process.env.STARTUP_DELAY_MS || 30000; // Default to 30s for Render/Deployment safety
        console.log(`⏳ [DEPLOYMENT SAFETY] Waiting ${delay / 1000}s for old instances to clear...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log('🧹 Wiping stale connection states from Dashboard DB...');
        await supabase.from('settings').update({ connection_status: 'disconnected', qr_code: null }).eq('id', 1);
        await connectToWhatsApp();
    } catch (e) {
        console.error('❌ Critical startup error:', e.message);
        // Fallback to connection attempt anyway
        connectToWhatsApp().catch(()=>{});
    }
}

// Graceful connection cleanup on container recycle
async function cleanupAndExit() {
    console.log('\n🛑 Render is shutting down the container. Wiping Dashboard QR state...');
    await supabase.from('settings').update({ connection_status: 'disconnected', qr_code: null }).eq('id', 1);
    process.exit(0);
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

startApp();
