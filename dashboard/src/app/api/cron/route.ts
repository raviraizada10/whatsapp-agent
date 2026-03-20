import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

    // Gemma 3 does NOT support systemInstruction, so we bake the instructions into the user prompt
    const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

    const fullPrompt = `You are a Cron Expression Generator. Your task is very simple.
Convert the following natural language schedule description into a valid standard Linux cron expression.
Rules: Output ONLY the raw 5-part cron string. No explanation. No quotes. No backticks. No markdown. Just the 5 parts separated by spaces (e.g. 0 9 * * *).

Schedule to convert: "${prompt}"

Cron expression:`;

    const result = await model.generateContent(fullPrompt);
    const cronExpression = result.response.text().trim().replace(/`/g, '').split('\n')[0].trim();

    return NextResponse.json({ cron: cronExpression });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
