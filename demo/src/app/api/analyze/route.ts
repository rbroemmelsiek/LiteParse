import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `Please analyze the following document text that was extracted using a PDF parser. 
Provide a brief summary and identify any key entities or topics discussed. Format your response beautifully using elegant markdown.

Document Text:
"""
${text}
"""`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const aiText = response.text();

    return NextResponse.json({ analysis: aiText });
  } catch (error: any) {
    console.error("Analyze API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
