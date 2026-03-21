const { google } = require('googleapis');
const { format, isToday, isTomorrow } = require('date-fns');

/**
 * Initialize Google Calendar API client using Service Account credentials from .env
 */
function getCalendarClient() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        console.warn('⚠️ Google Calendar credentials missing in .env');
        return null;
    }

    const auth = new google.auth.JWT(
        clientEmail,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/calendar.readonly']
    );

    return google.calendar({ version: 'v3', auth });
}

/**
 * Fetch upcoming events from a specific calendar
 * @param {Date} timeMin Start time
 * @param {Date} timeMax End time
 * @param {number} maxResults Max number of events to return
 */
async function getUpcomingEvents(timeMin, timeMax, maxResults = 10) {
    const calendar = getCalendarClient();
    if (!calendar) return null;

    try {
        const response = await calendar.events.list({
            calendarId: 'primary', // Assumes the service account has access to the primary calendar it was shared with
            timeMin: timeMin.toISOString(),
            timeMax: timeMax ? timeMax.toISOString() : undefined,
            maxResults: maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });
        return response.data.items;
    } catch (error) {
        console.error('❌ Error fetching Google Calendar events:', error.message);
        return null;
    }
}

/**
 * Format events into a string for the AI context
 */
function formatEventsForContext(events) {
    if (!events || events.length === 0) {
        return "No upcoming events found in the calendar.";
    }

    let contextList = [];
    events.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const startDate = new Date(start);
        
        let dateStr = format(startDate, 'PPpp'); // e.g., Apr 29, 2023, 5:30 PM
        if (isToday(startDate)) {
            dateStr = `Today at ${format(startDate, 'p')}`;
        } else if (isTomorrow(startDate)) {
            dateStr = `Tomorrow at ${format(startDate, 'p')}`;
        }

        contextList.push(`- ${event.summary} (${dateStr})`);
    });

    return contextList.join('\n');
}

/**
 * Checks for events starting within the next `minutesWindow`
 * Used for proactive cron job reminders
 */
async function getImminentEvents(minutesWindow = 15) {
    const now = new Date();
    const timeMax = new Date(now.getTime() + minutesWindow * 60 * 1000); // Now + 15 mins
    
    // To avoid fetching past events or things that already started, 
    // we only look for things starting *strictly after* right now.
    const events = await getUpcomingEvents(now, timeMax);
    return events || [];
}

module.exports = {
    getUpcomingEvents,
    formatEventsForContext,
    getImminentEvents
};
