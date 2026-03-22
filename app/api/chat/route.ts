// app/api/chat/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// The chatbot cycles through leaders so every session is fresh.
// We pick one deterministically per session via a query param.
const LEADERS = [
  {
    id: 0,
    name: "Narendra Modi",
    role: "Prime Minister of India",
    language: "Hindi",
    languageCode: "hi",
    flag: "🇮🇳",
  },
  {
    id: 1,
    name: "Emmanuel Macron",
    role: "President of France",
    language: "French",
    languageCode: "fr",
    flag: "🇫🇷",
  },
  {
    id: 2,
    name: "Pedro Sánchez",
    role: "Prime Minister of Spain",
    language: "Spanish",
    languageCode: "es",
    flag: "🇪🇸",
  },
  {
    id: 3,
    name: "Olaf Scholz",
    role: "Chancellor of Germany",
    language: "German",
    languageCode: "de",
    flag: "🇩🇪",
  },
];

export async function GET() {
  // Returns a random leader for the session
  const leader = LEADERS[Math.floor(Math.random() * LEADERS.length)];
  return NextResponse.json({ leader });
}

export async function POST(req: NextRequest) {
  try {
    const { message, leaderId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const leader = LEADERS[leaderId ?? 0] ?? LEADERS[0];

    const systemPrompt = `You are ${leader.name}, ${leader.role}.

Your task is to analyse the user's message, determine its type, respond in character, and return a JSON object.

## Determining Input Type

### Type 1 — "task_deadline"
The message contains BOTH:
  - A task or action to be done (e.g. "submit report", "finish presentation", "call the client")
  - A deadline expressed as a time or date (e.g. "by 5pm", "in 3 hours", "tomorrow morning", "Monday", "tonight")
Assume today is ${new Date().toUTCString()} when calculating hours.

### Type 2 — "number"
The message is primarily or entirely a number (integer or decimal), possibly with minor surrounding text like "my lucky number is 42" or just "1337".

### Type 3 — "general"
Everything else — questions, statements, complaints, jokes, greetings, emotions.

---

## Your Response Rules

1. **Always respond in ${leader.language}** as ${leader.name} would — use your characteristic speaking style, catchphrases, or rhetorical flair.
2. **Keep the response concise**: 2–3 sentences maximum.
3. **Provide an English translation** of your response.
4. **Do not break character.**

---

## JSON Schema — return ONLY valid JSON, no markdown fences, no extra keys:

{
  "inputType": "task_deadline" | "number" | "general",
  "response": "<response in ${leader.language}>",
  "translation": "<English translation>",
  "colorValue": <number — see rules below>,
  "toneLabel": "<very_sad | sad | neutral | happy | very_happy>"
}

### colorValue rules:
- task_deadline → hours until the deadline (decimal ok; use 0 if deadline has passed; use 999 if no specific time given but clearly far future)
- number → the last two digits of the extracted number as an integer 0–99 (e.g. 1337 → 37; 100 → 0; 50 → 50)
- general → emotional tone score from -100 (very sad) to +100 (very happy)

### toneLabel rules:
- Always set this based on the user's emotional tone, regardless of inputType.

Return ONLY the JSON object.`;

    const result = await geminiModel.generateContent({
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 600 },
    });

    const raw = result.response.text();

    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON", raw },
        { status: 500 }
      );
    }

    return NextResponse.json({ ...parsed, leader });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
