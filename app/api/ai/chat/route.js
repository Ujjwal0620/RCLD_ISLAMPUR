import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectMongoDB } from "@/lib/mongodb";
import AIConversation from "@/models/AIConversation";
import { AI_CONTEXT_VERSION, RCLD_AI_CONTEXT } from "@/data/aiContext";

// Keep the provider/model choice server-side and model-independent from ERP context.
// Do not allow an old local GROQ_MODEL value to silently switch this route back
// to a retired model.
const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "qwen/qwen3.8-27b";

function cleanMessages(messages = []) {
  return messages
    .filter(
      (message) =>
        (message?.role === "user" || message?.role === "assistant") &&
        typeof message?.content === "string" &&
        message.content.trim()
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

async function callGroq(apiKey, model, messages) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function shouldTryFallback(response) {
  return !response.ok && [400, 403, 404, 422].includes(response.status);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "Groq",
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    apiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
    contextVersion: AI_CONTEXT_VERSION,
  });
}

export async function POST(req) {
  try {
    const apiKey = (process.env.GROQ_API_KEY || "").trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Groq API key is not configured.",
          detail: "Add GROQ_API_KEY to the local .env file and restart npm run dev.",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const incomingMessages = cleanMessages(body.messages);

    if (!incomingMessages.length) {
      return NextResponse.json(
        { error: "Please enter a message before sending." },
        { status: 400 }
      );
    }

    const conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : crypto.randomUUID();

    let storedMessages = [];

    // Conversation persistence should improve the chatbot, but a temporary
    // database problem must not prevent the user from talking to the AI.
    try {
      await connectMongoDB();
      const conversation = await AIConversation.findOne({ conversationId }).lean();
      storedMessages = cleanMessages(conversation?.messages || []);
    } catch (databaseError) {
      console.error("AI conversation read failed:", databaseError);
    }

    const latestUserMessage =
      [...incomingMessages].reverse().find((message) => message.role === "user") ||
      incomingMessages[incomingMessages.length - 1];

    const history = storedMessages.length
      ? storedMessages
      : incomingMessages.slice(0, -1);

    const promptMessages = [
      { role: "system", content: RCLD_AI_CONTEXT },
      ...history.slice(-30),
      latestUserMessage,
    ];

    let usedModel = PRIMARY_MODEL;
    let result = await callGroq(apiKey, PRIMARY_MODEL, promptMessages);

    if (shouldTryFallback(result.response)) {
      usedModel = FALLBACK_MODEL;
      result = await callGroq(apiKey, FALLBACK_MODEL, promptMessages);
    }

    if (!result.response.ok) {
      return NextResponse.json(
        {
          error: result.data?.error?.message || "Groq could not complete the request.",
          detail: "The ERP tried both configured AI models.",
          provider: "Groq",
          model: usedModel,
          status: result.response.status,
        },
        { status: 502 }
      );
    }

    const reply =
      result.data?.choices?.[0]?.message?.content?.trim() ||
      "The AI returned an empty response. Please try again.";

    const newMessages = [
      ...storedMessages,
      { role: "user", content: latestUserMessage.content, model: usedModel },
      { role: "assistant", content: reply, model: usedModel },
    ].slice(-100);

    try {
      await connectMongoDB();
      await AIConversation.findOneAndUpdate(
        { conversationId },
        {
          $set: {
            messages: newMessages,
            lastModel: usedModel,
            contextVersion: AI_CONTEXT_VERSION,
          },
          $setOnInsert: {
            title: latestUserMessage.content.slice(0, 80),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (databaseError) {
      console.error("AI conversation save failed:", databaseError);
    }

    return NextResponse.json({
      reply,
      conversationId,
      provider: "Groq",
      model: usedModel,
      contextVersion: AI_CONTEXT_VERSION,
    });
  } catch (error) {
    console.error("AI chat route failed:", error);

    return NextResponse.json(
      {
        error: "AI service unavailable.",
        detail: error?.message || "Unknown server error.",
      },
      { status: 500 }
    );
  }
}
