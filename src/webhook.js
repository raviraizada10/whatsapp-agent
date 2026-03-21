const express = require('express');
const { supabase } = require('./db');

let globalActiveJobs = {};
let globalSock = null;

function setWebhookGlobals(jobs, sock) {
    globalActiveJobs = jobs;
    globalSock = sock;
}

/**
 * Start the Express webhook server on PORT
 * Also polls delivery_queue for approved messages and sends them
 */
function startWebhookServer() {
    const app = express();
    app.use(express.json());

    const PORT = process.env.PORT || process.env.WEBHOOK_PORT || 3001;

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', activeJobs: Object.keys(globalActiveJobs).length });
    });

    /**
     * POST /webhook/trigger
     * Body: { "schedule_id": "<uuid>" }
     * Optional auth: Header Authorization: Bearer <WEBHOOK_SECRET>
     */
    app.post('/webhook/trigger', async (req, res) => {
        const secret = process.env.WEBHOOK_SECRET;
        if (secret) {
            const authHeader = req.headers.authorization || '';
            if (authHeader !== `Bearer ${secret}`) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
        }

        const { schedule_id } = req.body;
        if (!schedule_id) {
            return res.status(400).json({ error: 'Missing schedule_id in request body' });
        }

        if (!globalActiveJobs[schedule_id]) {
            return res.status(404).json({ error: `No active job found for schedule_id: ${schedule_id}` });
        }

        try {
            console.log(`\n🌐 WEBHOOK TRIGGER received for schedule: ${schedule_id}`);
            await globalActiveJobs[schedule_id].invokeJob();
            return res.json({ success: true, message: `Job triggered for ${globalActiveJobs[schedule_id].recipient_name}` });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    const server = app.listen(PORT, () => {
        console.log(`🌐 Webhook server listening on port ${PORT}`);
        console.log(`   POST /webhook/trigger  { schedule_id: "<uuid>" }`);
        console.log(`   GET  /health`);
    });
    app.server = server;

    // Poll delivery_queue every 10 seconds for approved messages and send them
    setInterval(async () => {
        if (!supabase || !globalSock) return;
        try {
            const { data } = await supabase
                .from('delivery_queue')
                .select(`
                    *,
                    contacts (
                        name,
                        phone
                    )
                `)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const seenSchedules = new Set();
                const MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes
                const now = new Date();

                for (const item of data) {
                    const createdAt = new Date(item.created_at);
                    const ageMs = now - createdAt;

                    // 1. Check for absolute Staleness (60 mins)
                    if (ageMs > MAX_AGE_MS) {
                        console.log(`⚠️ Skipping STALE message for ${item.recipient_name} (Age: ${Math.round(ageMs/1000/60)}m)`);
                        await supabase.from('delivery_queue').update({ status: 'stale' }).eq('id', item.id);
                        continue;
                    }

                    // 2. Check for Deduplication (only latest per schedule)
                    if (seenSchedules.has(item.schedule_id)) {
                        console.log(`⏩ Skipping SUPERSEDED message for ${item.recipient_name} (Newer message available)`);
                        await supabase.from('delivery_queue').update({ status: 'superseded' }).eq('id', item.id);
                        continue;
                    }

                    // 3. Send the latest valid message
                    try {
                        seenSchedules.add(item.schedule_id);
                        
                        const recipientPhone = item.contacts?.phone;
                        const recipientName = item.contacts?.name || 'Unknown Contact';

                        if (!recipientPhone) {
                            console.error(`❌ Cannot send approved message for ID: ${item.id}. Linked contact missing.`);
                            await supabase.from('delivery_queue').update({ status: 'error' }).eq('id', item.id);
                            continue;
                        }

                        const jid = `${recipientPhone}@s.whatsapp.net`;
                        await globalSock.sendMessage(jid, { text: item.message_text });
                        await supabase.from('delivery_queue').update({ status: 'sent' }).eq('id', item.id);
                        console.log(`✅ Approved (Latest) message sent to ${recipientName} (${recipientPhone})`);
                    } catch (sendErr) {
                        console.error(`❌ Failed to send approved message for ID: ${item.id}:`, sendErr.message);
                    }
                }
            }
        } catch (e) {
            // silently skip poll errors
        }
    }, 10000);

    return app;
}

module.exports = { startWebhookServer, setWebhookGlobals };
