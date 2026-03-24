const schedule = require('node-schedule');
const { getActiveSchedules, supabase } = require('./db');
const { generateMessage } = require('./ai');
const { startWebhookServer } = require('./webhook');

const activeJobs = {}; // Tracks { job_instance, cron, prompt } // Store running jobs to allow pausing/canceling
let currentSock = null;
let isInitialized = false;

/**
 * Initializes the background cron jobs
 * @param {object} sock - The Baileys WhatsApp socket
 */
function initScheduler(sock) {
    currentSock = sock;
    
    if (isInitialized) {
        console.log('⏰ Scheduler already running. Socket reference updated.');
        return;
    }
    
    if (!supabase) {
        console.error('❌ Cannot initialize scheduler: Supabase client is missing.');
        return;
    }
    
    isInitialized = true;
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
        try {
            const schedules = await getActiveSchedules();
            const activeIdsFromDb = schedules.map(s => s.id);

            // 1. Cancel jobs that were paused or deleted from the dashboard
            for (const id in activeJobs) {
                if (!activeIdsFromDb.includes(id)) {
                    console.log(`⏸️ Schedule paused/deleted. Canceling job for ID: ${id}`);
                    if (activeJobs[id].job) activeJobs[id].job.cancel();
                    delete activeJobs[id];
                }
            }

            // 2. Add new jobs or update existing jobs if their timing/prompt changed
            schedules.forEach(s => {
                const tz = process.env.TZ || 'Asia/Kolkata'; // Default to IST for user
                
                if (activeJobs[s.id]) {
                    const cached = activeJobs[s.id];
                    // If it hasn't changed, do nothing
                    if (cached.cron === s.time_cron && cached.prompt === s.constraint_prompt) {
                        return;
                    }
                    // If it changed, cancel the old one
                    console.log(`🔄 Updates detected for ${s.recipient_name}. Reloading job with [${s.time_cron}] (${tz})`);
                    if (cached.job) cached.job.cancel();
                } else {
                    console.log(`✅ Scheduling new job for ${s.recipient_name} at [${s.time_cron}] (${tz})`);
                }

                // Isolate execution logic
                const asyncCallback = async () => {
                    if (s.contact_number === 'Unknown Phone') {
                        console.error(`⚠️ Cannot execute schedule for ID: ${s.id}. No linked contact found.`);
                        return;
                    }
                    
                    const now = new Date();
                    const istTime = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                    console.log(`\n⚡ EXECUTION TRIGGERED: ${s.recipient_name}`);
                    console.log(`   Server Time (UTC): ${now.toISOString()}`);
                    console.log(`   Local Time (IST):  ${istTime}`);

                    try {
                        const { getContactPersona } = require('./db');
                        const persona = await getContactPersona(s.contact_number);
                        const msgText = await generateMessage(s.recipient_name, s.constraint_prompt, persona);

                        if (!msgText) {
                            console.error(`❌ AI generation failed for ${s.recipient_name}. Skipping send.`);
                            return;
                        }

                        if (s.requires_approval) {
                            const { error: insertErr } = await supabase.from('delivery_queue').insert([{
                                schedule_id: s.id,
                                contact_id: s.contact_id,
                                message_text: msgText,
                                status: 'draft'
                            }]);

                            if (insertErr) {
                                console.error(`❌ DB Queue Error: ${insertErr.message}`);
                            } else {
                                console.log(`📋 Message for ${s.recipient_name} queued for approval.`);
                            }
                        } else {
                            const jid = `${s.contact_number}@s.whatsapp.net`;
                            if (currentSock) {
                                await currentSock.sendMessage(jid, { text: msgText });
                                console.log(`📩 AI message successfully sent to ${s.recipient_name}!`);
                            } else {
                                console.error('❌ Cannot send message: currentSock is null');
                            }
                        }
                    } catch (e) {
                         console.error(`❌ Failed to execute AI job for ${s.recipient_name}:`, e.message);
                    }
                };

                // Create the job with specific timezone
                const jobInstance = schedule.scheduleJob({ rule: s.time_cron, tz }, asyncCallback);

                // Store in memory
                activeJobs[s.id] = {
                    job: jobInstance,
                    cron: s.time_cron,
                    prompt: s.constraint_prompt,
                    recipient_name: s.recipient_name,
                    invokeJob: asyncCallback
                };
            });
        } catch (err) {
            console.error('❌ syncJobs fatal error:', err.message);
        }
    };

    // Run the sync immediately on startup
    syncJobs();

    // Poll the Supabase database for new/updated/paused schedules every 60 seconds
    setInterval(syncJobs, 60 * 1000);

    // Start the webhook server, sharing the activeJobs reference
    // startWebhookServer is now called immediately in index.js
}

module.exports = { initScheduler, activeJobs };
