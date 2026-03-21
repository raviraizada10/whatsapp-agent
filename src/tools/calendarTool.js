const { getUpcomingEvents, formatEventsForContext } = require('../calendar');

/**
 * Fetch and format upcoming calendar events
 * @param {object} args { days: number }
 */
async function getCalendarEvents({ days = 1 }) {
    console.log(`📅 Tool: Calendar Check -> for the next ${days} days`);
    
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + days);
    
    try {
        const events = await getUpcomingEvents(now, future);
        if (!events) return "I couldn't access your calendar. Please check my credentials.";
        
        return formatEventsForContext(events);
    } catch (e) {
        console.error('Calendar Tool Failed:', e.message);
        return `Calendar access failed: ${e.message}`;
    }
}

module.exports = {
    name: "check_calendar",
    description: "Get upcoming meetings, events, and appointments from your Google Calendar.",
    parameters: {
        type: "object",
        properties: {
            days: { type: "number", description: "Number of days to check for events (default 1)" }
        }
    },
    execute: getCalendarEvents
};
