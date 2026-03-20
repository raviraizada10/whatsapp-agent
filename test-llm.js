require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testModels() {
    console.log("=== GEMINI DEBUG TEST ===");
    console.log("API Key present:", !!process.env.GEMINI_API_KEY);
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const prompt = `Write a short, friendly WhatsApp message for John on my behalf.
The goal of the message is: "Remind me to test the bot." 
Write ONLY the exact message to be sent. Speak in the first person ("I"). Keep it extremely natural.`;

    // Test gemini-pro
    try {
        console.log("\nTesting [gemini-pro]...");
        const modelPro = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const resPro = await modelPro.generateContent(prompt);
        console.log("Response:", resPro.response.text());
    } catch (e) {
        console.error("Error with gemini-pro:", e.message);
    }
    
    // Test gemini-1.5-flash
    try {
        console.log("\nTesting [gemini-1.5-flash]...");
        const modelFlash = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const resFlash = await modelFlash.generateContent(prompt);
        console.log("Response:", resFlash.response.text());
    } catch (e) {
        console.error("Error with gemini-1.5-flash:", e.message);
    }
}

testModels();
