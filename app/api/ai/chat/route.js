import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectMongoDB } from "@/lib/mongodb";
import AIConversation from "@/models/AIConversation";
import { AI_CONTEXT_VERSION, RCLD_AI_CONTEXT } from "@/data/aiContext";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "qwen/qwen3.8-27b";
const DEPRECATED_MODELS = new Set(["llama-3.3-70b-versatile"]);

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

function getConfiguredModel() {
  const configured = (process.env.GROQ_MODEL || "").trim();

  if (!configured || DEPRECATED_MODELS.has(configured)) {
    return DEFAULT_MODEL;
  }

  return configured;
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
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const incomingMessages = cleanMessages(body.messages);
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "GROQ_API_KEY is not configured. Add it to .env or .env.local before using AI.",
        },
        { status: 503 }
      );
    }

    if (!incomingMessages.length) {
      return NextResponse.json(
        { error: "At least one user message is required." },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : crypto.randomUUID();

    const conversation = await AIConversation.findOne({ conversationId }).lean();
    const storedMessages = cleanMessages(conversation?.messages || []);

    const history = storedMessages.length
      ? storedMessages
      : incomingMessages.slice(0, -1);

    const latestUserMessage =
      [...incomingMessages].reverse().find((message) => message.role === "user") ||
      incomingMessages[incomingMessages.length - 1];

    const promptMessages = [
      { role: "system", content: RCLD_AI_CONTEXT },
      ...history.slice(-24),
      latestUserMessage,
    ];

    const configuredModel = getConfiguredModel();
    let usedModel = configuredModel;
    let { response, data } = await callGroq(
      apiKey,
      configuredModel,
      promptMessages
    );

    const modelUnavailable =
      !response.ok &&
      (response.status === 400 || response.status === 404) &&
      /model|does not exist|access|decommissioned|deprecated/i.test(
        data?.error?.message || ""
      );

    if (modelUnavailable && configuredModel !== FALLBACK_MODEL) {
      usedModel = FALLBACK_MODEL;
      ({ response, data } = await callGroq(
        apiKey,
        FALLBACK_MODEL,
        promptMessages
      ));
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: data?.error?.message || "Groq request failed.",
          model: usedModel,
          configuredModel,
        },
        { status: 502 }
      );
    }

    const reply =
      data?.choices?.[0]?.message?.content?.trim() || "No response returned.";

    const newMessages = storedMessages.length
      ? [
          ...storedMessages,
          { role: "user", content: latestUserMessage.content, model: usedModel },
          { role: "assistant", content: reply, model: usedModel },
        ]
      : [
          ...history,
          { role: "user", content: latestUserMessage.content, model: usedModel },
          { role: "assistant", content: reply, model: usedModel },
        ];

    await AIConversation.findOneAndUpdate(
      { conversationId },
      {
        $set: {
          messages: newMessages.slice(-100),
          lastModel: usedModel,
          contextVersion: AI_CONTEXT_VERSION,
        },
        $setOnInsert: {
          title: latestUserMessage.content.slice(0, 80),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      reply,
      conversationId,
      model: usedModel,
      configuredModel,
      contextVersion: AI_CONTEXT_VERSION,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "AI service unavailable.", detail: error.message },
      { status: 500 }
    );
  }
}
