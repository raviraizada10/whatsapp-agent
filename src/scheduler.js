const schedule = require('node-schedule');
const { getActiveSchedules, supabase } = require('./db');
const { generateMessage } = require('./ai');
const { startWebhookServer } = require('./webhook');

const activeJobs = {}; // Tracks { job_instance, cron, prompt } // Store running jobs to allow pausing/canceling

/**
 * Initializes the background cron jobs
 * @param {object} sock - The Baileys WhatsApp socket
 */
function initScheduler(sock) {
    console.log('⏰ Initializing periodic scheduler module...');
    
    setInterval(async () => {
        if (!supabase) return;
        try {
            const { data } = await supabase.from('manual_triggers').select('id, schedule_id');
            if (data && data.length > 0) {
                for (const trigger of data) {
                    await supabase.from('manual_triggers').delete().eq('id', trigger.id);
                    if (activeJobs[trigger.schedule_id]) {
                        console.log(`\n⚡ MANUAL TRIGGER: Immediate execution for ${activeJobs[trigger.schedule_id].recipient_name}!`);
                        await activeJobs[trigger.schedule_id].invokeJob();
                    }
                }
            }
        } catch (e) {
            console.error('Manual trigger polling error:', e.message);
        }
    }, 5000);

    const syncJobs = async () => {
        const schedules = await getActiveSchedules();
        const activeIdsFromDb = schedules.map(s => s.id);

        // 1. Cancel jobs that were paused or deleted from the dashboard
        for (const id in activeJobs) {
            if (!activeIdsFromDb.includes(id)) {
                console.log(`⏸️ Schedule paused/deleted. Canceling job for ID: ${id}`);
                activeJobs[id].job.cancel();
                delete activeJobs[id];
            }
        }

        // 2. Add new jobs or update existing jobs if their timing/prompt changed
        schedules.forEach(s => {
            if (activeJobs[s.id]) {
                const cached = activeJobs[s.id];
                // If it hasn't changed, do nothing
                if (cached.cron === s.time_cron && cached.prompt === s.constraint_prompt) {
                    return;
                }
                // If it changed, cancel the old one
                console.log(`🔄 Updates detected for ${s.recipient_name}. Reloading job.`);
                cached.job.cancel();
            } else {
                console.log(`✅ Scheduling new job for ${s.recipient_name} at [${s.time_cron}]`);
            }

            // Isolate execution logic so it can be invoked manually or by cron
            const asyncCallback = async () => {
                console.log(`⚡ Executing schedule for ${s.recipient_name}...`);
                try {
                    const { getContactPersona } = require('./db');
                    const persona = await getContactPersona(s.contact_number);
                    const msgText = await generateMessage(s.recipient_name, s.constraint_prompt, persona);

                    if (s.requires_approval) {
                        // Approval mode: write to queue, don't send yet
                        const { error: insertErr } = await supabase.from('delivery_queue').insert([{
                            schedule_id: s.id,
                            recipient_name: s.recipient_name,
                            contact_number: s.contact_number,
                            message_text: msgText,
                            status: 'draft'
                        }]);

                        if (insertErr) {
                            console.error(`❌ DB Queue Error: ${insertErr.message}`);
                        } else {
                            console.log(`📋 Message for ${s.recipient_name} queued for approval.`);
                        }
                    } else {
                        // Normal mode: send immediately
                        const jid = `${s.contact_number}@s.whatsapp.net`;
                        await sock.sendMessage(jid, { text: msgText });
                        console.log(`📩 AI message successfully sent to ${s.recipient_name}!`);
                    }
                } catch (e) {
                     console.error(`❌ Failed to execute AI job for ${s.recipient_name}`, e);
                }
            };

            // Create or recreate the job
            const jobInstance = schedule.scheduleJob(s.time_cron, asyncCallback);

            // Store it in our in-memory cache
            activeJobs[s.id] = {
                job: jobInstance,
                cron: s.time_cron,
                prompt: s.constraint_prompt,
                recipient_name: s.recipient_name,
                invokeJob: asyncCallback
            };
        });
    };

    // Run the sync immediately on startup
    syncJobs();

    // Poll the Supabase database for new/updated/paused schedules every 60 seconds
    setInterval(syncJobs, 60 * 1000);

    // Start the webhook server, sharing the activeJobs reference
    // startWebhookServer is now called immediately in index.js
}

module.exports = { initScheduler, activeJobs };
