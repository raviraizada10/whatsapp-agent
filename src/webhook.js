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
        res.json({
            status: 'ok',
            activeJobsCount: Object.keys(globalActiveJobs).length,
            time: new Date().toISOString()
        });
    });

    app.get('/debug', (req, res) => {
        const jobs = Object.values(globalActiveJobs).map(j => ({
            recipient: j.recipient_name,
            cron: j.cron,
            prompt: j.prompt.substring(0, 50) + '...'
        }));
        res.json({
            loadedSchedules: jobs,
            activeSockets: globalSock ? 'active' : 'null',
            serverTime: new Date().toISOString()
        });
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

    // Poll delivery_queue for approved messages and send them
    async function pollApprovedQueue() {
        if (!supabase || !globalSock) {
            setTimeout(pollApprovedQueue, 10000);
            return;
        }

        try {
            const { data, error } = await supabase
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

            if (error) throw error;

            if (data && data.length > 0) {
                console.log(`📋 Found ${data.length} approved messages in queue.`);
                const seenSchedules = new Set();
                const MAX_AGE_MS = 60 * 60 * 1000; // 60 minutes
                const now = new Date();

                for (const item of data) {
                    const createdAt = new Date(item.created_at);
                    const ageMs = now - createdAt;

                    // 1. Check for absolute Staleness
                    if (ageMs > MAX_AGE_MS) {
                        console.log(`⚠️ Marking STALE: ${item.id} (Recipient: ${item.contacts?.name || 'Unknown'})`);
                        await supabase.from('delivery_queue').update({ status: 'stale' }).eq('id', item.id);
                        continue;
                    }

                    // 2. Check for Deduplication (only latest per schedule)
                    if (seenSchedules.has(item.schedule_id)) {
                        console.log(`⏩ Marking SUPERSEDED: ${item.id} (Schedule: ${item.schedule_id} already sent)`);
                        await supabase.from('delivery_queue').update({ status: 'superseded' }).eq('id', item.id);
                        continue;
                    }

                    // 3. Send the latest valid message
                    try {
                        seenSchedules.add(item.schedule_id);
                        
                        const recipientPhone = item.contacts?.phone;
                        const recipientName = item.contacts?.name || 'Unknown Contact';

                        if (!recipientPhone) {
                            console.error(`❌ Missing phone for queue item ${item.id}`);
                            await supabase.from('delivery_queue').update({ status: 'error' }).eq('id', item.id);
                            continue;
                        }

                        console.log(`📩 Dispatching latest approved message to ${recipientName}...`);
                        const jid = `${recipientPhone}@s.whatsapp.net`;
                        await globalSock.sendMessage(jid, { text: item.message_text });
                        
                        // NEW: Log to history
                        try {
                            await supabase.from('history').insert([{
                                contact_id: item.contact_id,
                                schedule_id: item.schedule_id,
                                content: item.message_text,
                                status: 'sent'
                            }]);
                            console.log('✅ Logged to history.');
                        } catch (histErr) {
                            console.error('⚠️ Failed to log to history:', histErr.message);
                        }
                        
                        // Mark as sent immediately after success
                        const { error: updErr } = await supabase
                            .from('delivery_queue')
                            .update({ status: 'sent', sent_at: new Date().toISOString() })
                            .eq('id', item.id);
                        
                        if (updErr) console.error(`⚠️ Failed to update status to 'sent' for ${item.id}:`, updErr.message);
                        else console.log(`✅ DISPATCHED and MARKED SENT for ${recipientName}`);

                    } catch (sendErr) {
                        console.error(`❌ Send failure for ${item.id}:`, sendErr.message);
                        // Optional: mark as retry or error
                    }
                }
            }
        } catch (e) {
            console.error('❌ Webhook poll error:', e.message);
        } finally {
            // Self-calling timeout prevents overlapping executions
            setTimeout(pollApprovedQueue, 10000);
        }
    }

    // Start the poll loop
    pollApprovedQueue();

    return app;
}

module.exports = { startWebhookServer, setWebhookGlobals };
