require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testModels() {
    console.log("=== POLLING COMPLETELY FREE MODELS ===");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = 'Say hello world in 2 words.';

    const modelsToTest = [
        'gemini-flash-latest',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-lite-001',
        'gemma-3-e4b-it'
    ];

    for (const m of modelsToTest) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const res = await model.generateContent(prompt);
            console.log(`✅ [${m}] SUCCESS:`, res.response.text().trim());
            // If one works, we can exit.
            process.exit(0);
        } catch (e) {
            console.log(`❌ [${m}] ERROR:`, e.status || "", e.message.split('\n')[0]);
        }
    }
}
testModels();
