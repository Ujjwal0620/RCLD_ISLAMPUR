"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Send, Sparkles, RotateCcw } from "lucide-react";
import ERPLayout from "@/components/ERPLayout";

const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "I am the RCLD ERP AI assistant. Ask me about batches, courses, faculty allocation, fees, reports, students, employees, or ERP workflows.",
};

export default function AIPage() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [model, setModel] = useState("");
  const [service, setService] = useState(null);

  useEffect(() => {
    fetch("/api/ai/chat", { cache: "no-store" })
      .then((response) => response.json())
      .then(setService)
      .catch(() => setService({ ok: false }));
  }, []);

  async function send() {
    const userText = input.trim();
    if (!userText || loading) return;

    const userMessage = { role: "user", content: userText };
    const history = [...messages, userMessage].filter(
      (message) => message.role === "user" || message.role === "assistant"
    );

    setInput("");
    setMessages(history);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          messages: history.slice(-30),
        }),
      });

      const data = await response.json();

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.model) setModel(data.model);

      if (!response.ok) {
        const errorText = [data.error, data.detail, data.model ? `Model: ${data.model}` : ""]
          .filter(Boolean)
          .join("\n");

        setMessages((current) => [
          ...current,
          { role: "assistant", content: errorText || "AI request failed." },
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply || "No response returned." },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Unable to reach the ERP AI API. ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([WELCOME_MESSAGE]);
    setConversationId("");
    setModel("");
    setInput("");
  }

  return (
    <ERPLayout active="/dashboard/ai">
      <header className="topbar">
        <div>
          <div className="crumb">RCLD Islampur / AI Tools</div>
          <h1>AI Assistant</h1>
        </div>
        <button className="ghost-btn" onClick={newChat}>
          <RotateCcw size={16} /> New Chat
        </button>
      </header>

      <div className="ai-shell">
        <div className="ai-hero">
          <div className="ai-icon">
            <BrainCircuit size={26} />
          </div>
          <div>
            <span className="eyebrow">GROQ POWERED</span>
            <h2>RCLD ERP Copilot</h2>
            <p>
              AI conversations use persistent RCLD ERP context. Suggestions do
              not automatically modify financial or academic records.
            </p>
            <small>
              {service?.apiKeyConfigured === false
                ? "Groq API key is not configured."
                : model
                  ? `Connected · ${model}`
                  : service?.primaryModel
                    ? `Ready · ${service.primaryModel}`
                    : "Checking AI service…"}
            </small>
          </div>
        </div>

        <div className="ai-chat">
          {messages.map((message, index) => (
            <div key={index} className={"ai-message " + message.role}>
              <div className="ai-avatar">
                {message.role === "assistant" ? <Sparkles size={15} /> : "You"}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
            </div>
          ))}

          {loading && (
            <div className="ai-message assistant">
              <div className="ai-avatar">
                <Sparkles size={15} />
              </div>
              <div>Thinking…</div>
            </div>
          )}
        </div>

        <div className="ai-composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Ask the RCLD ERP Copilot…"
          />
          <button className="primary-btn" onClick={send} disabled={loading}>
            <Send size={16} /> {loading ? "Thinking…" : "Ask AI"}
          </button>
        </div>
      </div>
    </ERPLayout>
  );
}
