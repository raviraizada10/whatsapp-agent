const { google } = require('googleapis');
const { format, isToday, isTomorrow } = require('date-fns');

/**
 * Initialize Google Calendar API client using Service Account credentials from .env
 */
function getCalendarClient() {
    // 1. Best Practice for Secret Files (e.g. Render Secret Files)
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });
        return google.calendar({ version: 'v3', auth });
    }

    // 2. Fallback for raw environment variables string
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        console.warn('⚠️ Google Calendar credentials missing in environment.');
        return null;
    }

    const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    });

    return google.calendar({ version: 'v3', auth });
}

/**
 * Fetch upcoming events from ALL accessible calendars
 * @param {Date} timeMin Start time
 * @param {Date} timeMax End time
 * @param {number} maxResults Max number of events to return ACROSS all calendars
 */
async function getUpcomingEvents(timeMin, timeMax, maxResults = 10) {
    const calendar = getCalendarClient();
    if (!calendar) return null;

    try {
        // 1. List all calendars accessible to this service account
        const calendarList = await calendar.calendarList.list();
        const calendars = calendarList.data.items || [];
        
        if (calendars.length === 0) {
            console.warn('⚠️ No calendars shared with this service account.');
            return [];
        }

        console.log(`📅 Multi-Calendar: Searching for events in ${calendars.length} calendars...`);
        
        const allEvents = [];
        
        // 2. Fetch events from each calendar
        for (const cal of calendars) {
            try {
                const response = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: timeMin.toISOString(),
                    timeMax: timeMax ? timeMax.toISOString() : undefined,
                    maxResults: maxResults,
                    singleEvents: true,
                    orderBy: 'startTime',
                });
                
                if (response.data.items) {
                    allEvents.push(...response.data.items);
                }
            } catch (err) {
                console.error(`❌ Failed to fetch events for calendar "${cal.summary}" (${cal.id}):`, err.message);
            }
        }

        // 3. Sort merged events by start time
        allEvents.sort((a, b) => {
            const startA = new Date(a.start.dateTime || a.start.date);
            const startB = new Date(b.start.dateTime || b.start.date);
            return startA - startB;
        });

        // 4. Return limited results
        return allEvents.slice(0, maxResults);
    } catch (error) {
        console.error('❌ Error in multi-calendar fetch:', error.message);
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
