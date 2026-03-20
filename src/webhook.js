const express = require('express');
const { supabase } = require('./db');

/**
 * Start the Express webhook server on PORT 3001
 * Also polls delivery_queue for approved messages and sends them
 * @param {object} activeJobs - Reference to the scheduler's activeJobs map
 * @param {object} sock - Baileys WhatsApp socket
 */
function startWebhookServer(activeJobs, sock) {
    const app = express();
    app.use(express.json());

    const PORT = process.env.WEBHOOK_PORT || 3001;

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', activeJobs: Object.keys(activeJobs).length });
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

        if (!activeJobs[schedule_id]) {
            return res.status(404).json({ error: `No active job found for schedule_id: ${schedule_id}` });
        }

        try {
            console.log(`\n🌐 WEBHOOK TRIGGER received for schedule: ${schedule_id}`);
            await activeJobs[schedule_id].invokeJob();
            return res.json({ success: true, message: `Job triggered for ${activeJobs[schedule_id].recipient_name}` });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    app.listen(PORT, () => {
        console.log(`🌐 Webhook server listening on port ${PORT}`);
        console.log(`   POST /webhook/trigger  { schedule_id: "<uuid>" }`);
        console.log(`   GET  /health`);
    });

    // Poll delivery_queue every 10 seconds for approved messages and send them
    setInterval(async () => {
        if (!supabase || !sock) return;
        try {
            const { data } = await supabase
                .from('delivery_queue')
                .select('*')
                .eq('status', 'approved');

            if (data && data.length > 0) {
                for (const item of data) {
                    try {
                        const jid = `${item.contact_number}@s.whatsapp.net`;
                        await sock.sendMessage(jid, { text: item.message_text });
                        await supabase.from('delivery_queue').update({ status: 'sent' }).eq('id', item.id);
                        console.log(`✅ Approved message sent to ${item.recipient_name} (${item.contact_number})`);
                    } catch (sendErr) {
                        console.error(`❌ Failed to send approved message to ${item.recipient_name}:`, sendErr.message);
                    }
                }
            }
        } catch (e) {
            // silently skip poll errors
        }
    }, 10000);

    return app;
}

module.exports = { startWebhookServer };
