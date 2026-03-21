const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const cheerio = require('cheerio');
const { trackTrain } = require('irctc-connect');

/**
 * Perform a discrete live web search to inject context for the AI
 */
async function getLiveWebContext(query) {
    try {
        console.log(`🔍 Live Web Search Triggered for: "${query}"`);
        const res = await axios.post('https://lite.duckduckgo.com/lite/', 
            'q=' + encodeURIComponent(query), 
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' } }
        );
        const $ = cheerio.load(res.data);
        const snippets = [];
        $('.result-snippet').each((i, el) => {
            snippets.push($(el).text().trim());
        });
        if (snippets.length > 0) {
            console.log(`✅ Web Search Success: Found ${snippets.length} relevant snippets.`);
            return snippets.slice(0, 3).join('\n---\n');
        }
        return null;
    } catch (e) {
        console.error('Web Search Failed:', e.message);
        return null;
    }
}

/**
 * Generate a personalized WhatsApp message
 * @param {string} recipientName The name of the recipient (e.g. Dad, Wife)
 * @param {string} constraint The context/constraint for the message
 * @param {string|null} personaContext Optional persona context for this contact
 * @returns {Promise<string>} The generated message
 */
async function generateMessage(recipientName, constraint, personaContext = null) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });
        
        let prompt = `SYSTEM RULES:\nYou are a highly emotionally intelligent, human-like personal assistant.\nYou must generate EXACTLY ONE WhatsApp message.\nThe message is being sent on behalf of the USER to the CONTACT.\nYou MUST NOT include any conversational filler like 'Here is the message:' or quotes.\nJust write the raw text the user will send.\n\n`;

        if (personaContext) {
            prompt += `CRITICAL CONTEXT ABOUT THIS CONTACT (Deeply weave this into the tone/phrasing): "${personaContext}"\n\n`;
        }

        // Trigger live search for specific keywords requesting real-time data
        const lowerConstraint = constraint ? constraint.toString().toLowerCase() : "";
        
        let liveData = null;
        
        // 1. Check for specific Train Tracking requests (5-digit number)
        const trainMatch = lowerConstraint.match(/train\s*(\d{5})|(\d{5})\s*train/);
        if (trainMatch) {
            const trainNo = trainMatch[1] || trainMatch[2];
            
            // Look for a date in dd-mm-yyyy or dd/mm/yyyy format
            const dateMatch = lowerConstraint.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})/);
            let journeyDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
            if (dateMatch) {
                journeyDate = dateMatch[0].replace(/\//g, '-');
            }

            console.log(`🚂 Live Train Tracking Triggered for: ${trainNo} on ${journeyDate}`);
            try {
                const trainResponse = await trackTrain(trainNo, journeyDate);
                if (trainResponse && trainResponse.success && trainResponse.data) {
                    const data = trainResponse.data;
                    const scheduleStr = data.stations ? data.stations.map(s => {
                        const arr = s.arrival || {};
                        const dep = s.departure || {};
                        return `${s.stationName} (${s.stationCode}): Arr ${arr.scheduled} -> ${arr.actual} (Delay: ${arr.delay}), Dep ${dep.scheduled} -> ${dep.actual}, Platform: ${s.platform}`;
                    }).join('\n') : "No station details available";
                    
                    liveData = `🚨 LIVE TRAIN STATUS FOR ${data.trainName} (${data.trainNo}) [Journey Date: ${data.date}]:\nStatus Update: ${data.statusNote} (${data.lastUpdate})\n\nSchedule Data:\n${scheduleStr}`;
                    console.log(`✅ Train Data Fetched Successfully via irctc-connect!`);
                }
            } catch (e) {
                console.error('Train API Failed:', e.message);
            }
        }

        // 2. Generic Web Search Fallback
        const requiresLiveSearch = lowerConstraint.match(/\b(weather|live|score|news|search)\b/);
        if (!liveData && requiresLiveSearch) {
            liveData = await getLiveWebContext(constraint);
        }

        // 3. Calendar Check
        const requiresCalendar = lowerConstraint.match(/\b(schedule|calendar|meetings|appointments|events)\b/);
        if (requiresCalendar && !liveData) {
            const { getUpcomingEvents, formatEventsForContext } = require('./calendar');
            console.log(`📅 Calendar Check Triggered by constraint.`);
            const now = new Date();
            const eod = new Date();
            eod.setHours(23, 59, 59, 999);
            // Default to today's events if they ask for schedule
            const events = await getUpcomingEvents(now, eod);
            if (events) {
                const formattedEvents = formatEventsForContext(events);
                liveData = `📅 UPCOMING CALENDAR EVENTS:\n${formattedEvents}`;
            }
        }
        
        if (liveData) {
            prompt += `REAL-TIME FACTUAL DATA FOUND FOR THIS REQUEST:\n${liveData}\n\nUSE THIS EXACT FACTUAL DATA TO WRITE YOUR NEXT MESSAGE! Do not make up any times or statuses.\n\n`;
        }

        prompt += `TASK:\nGenerate a WhatsApp message for my contact named "${recipientName}".\nConstraint/Specific Instructions: ${constraint}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        if (!responseText) {
            console.warn('⚠️ AI returned empty response text.');
            return null;
        }
        
        return responseText;
    } catch (error) {
        console.error('Error generating AI message:', error.message);
        // Return null instead of prompt so we don't spam the user with "Find the Live ETA..."
        return null;
    }
}

module.exports = {
    generateMessage
};
