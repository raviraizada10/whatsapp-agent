const { trackTrain } = require('irctc-connect');

/**
 * Handle Train Tracking requests (5-digit number)
 * @param {object} args { trainNo: string, date: string }
 */
async function getTrainStatus({ trainNo, date }) {
    if (!trainNo) return "Please provide a 5-digit train number.";
    
    // Default to today if date not provided
    let journeyDate = date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    
    console.log(`🚂 Tool: Train Tracking -> ${trainNo} on ${journeyDate}`);
    try {
        const trainResponse = await trackTrain(trainNo, journeyDate);
        if (trainResponse && trainResponse.success && trainResponse.data) {
            const data = trainResponse.data;
            const scheduleStr = data.stations ? data.stations.map(s => {
                const arr = s.arrival || {};
                const dep = s.departure || {};
                return `${s.stationName} (${s.stationCode}): Arr ${arr.scheduled} -> ${arr.actual} (Delay: ${arr.delay}), Dep ${dep.scheduled} -> ${dep.actual}, Platform: ${s.platform}`;
            }).join('\n') : "No station details available";
            
            return `🚨 LIVE TRAIN STATUS FOR ${data.trainName} (${data.trainNo}) [Journey Date: ${data.date}]:\nStatus Update: ${data.statusNote} (${data.lastUpdate})\n\nSchedule Data:\n${scheduleStr}`;
        }
        return `Failed to find train tracking info for ${trainNo} on ${journeyDate}.`;
    } catch (e) {
        console.error('Train Status Tool Failed:', e.message);
        return `Train search failed: ${e.message}`;
    }
}

module.exports = {
    name: "track_train",
    description: "Get real-time tracking status, delays, and schedule for a specific train in India using its 5-digit number.",
    parameters: {
        type: "object",
        properties: {
            trainNo: { type: "string", description: "The 5-digit train number (e.g. '12004')" },
            date: { type: "string", description: "The journey date in dd-mm-yyyy format. Optional, defaults to today." }
        },
        required: ["trainNo"]
    },
    execute: getTrainStatus
};
