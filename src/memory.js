const { supabase } = require('./db');
const { generateMessage } = require('./ai');

const HISTORY_LIMIT = 10; // Last N messages to include as context

/**
 * Find contact ID by phone number
 */
async function getContactIdByPhone(phone) {
    if (!supabase) return null;
    const { data } = await supabase.from('contacts').select('id').eq('phone', phone).single();
    return data ? data.id : null;
}

/**
 * Save a message to chat_history
 */
async function saveMessage(contactPhone, role, content) {
    if (!supabase) return;
    try {
        const contactId = await getContactIdByPhone(contactPhone);
        if (!contactId) return; // Ignore messages from unknown contacts

        await supabase.from('chat_history').insert([{
            contact_id: contactId,
            role, // 'user' or 'agent'
            content
        }]);
    } catch (e) {
        console.error('Failed to save chat history:', e.message);
    }
}

/**
 * Fetch last N messages for a contact as formatted context string
 */
async function getConversationContext(contactPhone) {
    if (!supabase) return '';
    try {
        const contactId = await getContactIdByPhone(contactPhone);
        if (!contactId) return '';

        const { data } = await supabase
            .from('chat_history')
            .select('role, content, created_at')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT);

        if (!data || data.length === 0) return '';

        // Reverse to get chronological order and format
        return data
            .reverse()
            .map(m => `${m.role === 'agent' ? 'You (Agent)' : 'Contact'}: ${m.content}`)
            .join('\n');
    } catch (e) {
        console.error('Failed to fetch chat history:', e.message);
        return '';
    }
}

/**
 * Generate a contextual reply to an incoming message
 */
async function generateContextualReply(contactPhone, contactName, incomingMessage, personaContext = null) {
    const conversationHistory = await getConversationContext(contactPhone);

    let prompt = `You are a personal AI assistant replying to a WhatsApp message on behalf of the user.`;

    if (personaContext) {
        prompt += `\nContext about this contact: ${personaContext}`;
    }

    if (conversationHistory) {
        prompt += `\n\nPrevious conversation:\n${conversationHistory}`;
    }
    const safeMessage = incomingMessage ? incomingMessage.toString().toLowerCase() : "";
    const isCalendarQuery = safeMessage.match(/\b(schedule|calendar|meetings|appointments|events|today|tomorrow)\b/);
    if (isCalendarQuery) {
        // Assume ONLY the admin should be able to query the personal calendar
        const ADMIN_NUMBER = process.env.ADMIN_NUMBER;
        if (contactPhone === ADMIN_NUMBER) {
            const { getUpcomingEvents, formatEventsForContext } = require('./calendar');
            console.log(`📅 Admin Calendar Query Detected.`);
            const now = new Date();
            const eod = new Date();
            eod.setDate(now.getDate() + 1); // Look ahead roughly 48 hours for general queries
            eod.setHours(23, 59, 59, 999);
            const events = await getUpcomingEvents(now, eod, 20);
            if (events) {
                const formattedEvents = formatEventsForContext(events);
                prompt += `\n\nREAL-TIME CALENDAR DATA (Use this to precisely answer the user's question about their schedule):\n${formattedEvents}`;
            }
        }
    }

    prompt += `\n\nThe contact just said: "${incomingMessage}"`;
    prompt += `\n\nWrite a natural, concise reply. Only output the raw reply text, no quotes or explanations.`;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}

module.exports = { saveMessage, getConversationContext, generateContextualReply };
