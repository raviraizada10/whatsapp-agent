const { GoogleGenerativeAI } = require('@google/generative-ai');
const registry = require('./tools'); // Already initialized with tools

/**
 * Enhanced Agentic AI Loop using ReAct Pattern
 * @param {string} recipientName The name of the recipient
 * @param {string} constraint The user's request context
 * @param {string|null} personaContext Optional persona context
 * @returns {Promise<string>} Final WhatsApp message
 */
async function generateMessage(recipientName, constraint, personaContext = null) {
    const MAX_STEPS = 3;
    const modelName = 'gemma-3-27b-it'; // Updated to the correct suffix for the IT version
    
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });

        let history = [];
        let systemPrompt = `SYSTEM RULES:
You are Jarvis, a highly intelligent, sophisticated personal AI assistant.
Your goal is to fulfill the USER's request by thinking step-by-step and using tools when necessary.

${registry.formatToolsForPrompt()}

REACTION PROTOCOL:
Follow this format EXACTLY for every turn:
THOUGHT: [Reason about what to do next. Do we need a tool? Do we have enough info?]
ACTION: [Optional: Only if you need a tool. Format: tool_name({"param": "value"})]
FINAL RESPONSE: [Only when you are ready to answer the user. Write EXACTLY the raw WhatsApp message content. You are Jarvis, so be helpful, polite, and efficient.]

CONSTRAINTS:
- Use at most ${MAX_STEPS} tool calls per request.
- Be concise. WhatsApp messages should be natural and brief.
- If you use a tool, WAIT for the OBSERVATION before giving a FINAL RESPONSE.

USER CONTEXT:
- Recipient Name: "${recipientName}"
- Persona Context: "${personaContext || 'None'}"
- User Request: "${constraint}"

Begin!
`;

        history.push({ role: 'user', parts: [{ text: systemPrompt }] });

        for (let step = 0; step < MAX_STEPS + 1; step++) {
            console.log(`🤖 Step ${step + 1}: Informing Agent...`);
            
            const result = await model.generateContent({ contents: history });
            const responseText = result.response.text().trim();
            console.log(`\n--- AGENT THOUGHT ---\n${responseText}\n--------------------\n`);

            // 1. Check for FINAL RESPONSE
            if (responseText.includes('FINAL RESPONSE:')) {
                const finalMsg = responseText.split('FINAL RESPONSE:').pop().trim();
                return finalMsg || "Sorry, I couldn't generate a clear response.";
            }

            // 2. Parse ACTION
            const actionMatch = responseText.match(/ACTION:\s*([a-zA-Z_]+)\((.*)\)/);
            if (actionMatch) {
                const toolName = actionMatch[1];
                let toolParams = {};
                try {
                    toolParams = JSON.parse(actionMatch[2]);
                } catch (e) {
                    console.warn('⚠️ Tool params parsing failed, attempting raw string cleanup...');
                    // Fallback for non-strict JSON if possible
                    const rawParams = actionMatch[2].replace(/'/g, '"');
                    try { toolParams = JSON.parse(rawParams); } catch(err) {}
                }

                // Execute Tool
                const observation = await registry.call(toolName, toolParams);
                console.log(`👁️ OBSERVATION: ${observation.substring(0, 100)}...`);

                // Feedback to LLM
                history.push({ role: 'model', parts: [{ text: responseText }] });
                history.push({ role: 'user', parts: [{ text: `OBSERVATION: ${observation}` }] });
                continue;
            }

            // Fallback: If no action or final response, just return the text
            if (step === MAX_STEPS) {
                console.warn('⚠️ Reached Max Steps without Final Response.');
                return responseText.replace(/THOUGHT:.*|ACTION:.*/gs, '').trim() || "Agent timed out.";
            }
        }

    } catch (error) {
        console.error('🚨 Agent Execution Error:', error.message);
        return null;
    }
}

module.exports = {
    generateMessage
};
