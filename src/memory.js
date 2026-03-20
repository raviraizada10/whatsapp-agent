const { supabase } = require('./db');
const { generateMessage } = require('./ai');

const HISTORY_LIMIT = 10; // Last N messages to include as context

/**
 * Save a message to chat_history
 */
async function saveMessage(contactPhone, role, content) {
    if (!supabase) return;
    try {
        await supabase.from('chat_history').insert([{
            contact_phone: contactPhone,
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
        const { data } = await supabase
            .from('chat_history')
            .select('role, content, created_at')
            .eq('contact_phone', contactPhone)
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

    prompt += `\n\nThe contact just said: "${incomingMessage}"`;
    prompt += `\n\nWrite a natural, concise reply. Only output the raw reply text, no quotes or explanations.`;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemma-3-27b-it' });

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}

module.exports = { saveMessage, getConversationContext, generateContextualReply };
