"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X, RotateCcw } from "lucide-react";

const welcome = { role:"assistant", content:"Hi, I’m the RCLD ERP Copilot. I use RCLD project knowledge plus live ERP data. Ask me about students, employees, courses, batches, schedules, faculty, fees, attendance, or ERP workflows." };

export default function RAGAssistant() {
  const [open,setOpen]=useState(false);
  const [messages,setMessages]=useState([welcome]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [conversationId,setConversationId]=useState("");
  const [model,setModel]=useState("");
  const bottomRef=useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading,open]);

  async function send() {
    const text=input.trim();
    if(!text || loading) return;
    const next=[...messages,{role:"user",content:text}];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const response=await fetch("/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({conversationId:conversationId||undefined,messages:next.slice(-30)})});
      const data=await response.json();
      if(data.conversationId) setConversationId(data.conversationId);
      if(data.model) setModel(data.model);
      setMessages((current)=>[...current,{role:"assistant",content:response.ok?(data.reply||"No response returned."):[data.error,data.detail].filter(Boolean).join("\n")||"AI request failed.",sources:data.sources||[]}]);
    } catch(error) {
      setMessages((current)=>[...current,{role:"assistant",content:"Unable to reach the RCLD AI service. "+error.message}]);
    } finally { setLoading(false); }
  }

  function reset(){setMessages([welcome]);setConversationId("");setModel("");setInput("");}

  return <>
    {open && <section className="rag-panel" aria-label="RCLD ERP AI Copilot">
      <header className="rag-header">
        <div className="rag-brand"><span className="rag-brand-icon"><Sparkles size={18}/></span><div><strong>RCLD Copilot</strong><small>{model ? model : "RAG + Live ERP"}</small></div></div>
        <div className="rag-actions"><button onClick={reset} title="New chat"><RotateCcw size={16}/></button><button onClick={()=>setOpen(false)} title="Close"><X size={18}/></button></div>
      </header>
      <div className="rag-messages">
        {messages.map((message,index)=><div key={index} className={"rag-message "+message.role}>
          <div className="rag-bubble">{message.content}</div>
          {!!message.sources?.length && <div className="rag-sources">Sources: {message.sources.map((source)=>source.title).join(" · ")}</div>}
        </div>)}
        {loading && <div className="rag-message assistant"><div className="rag-bubble">Searching RCLD ERP context…</div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="rag-compose">
        <textarea value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask about RCLD ERP…" />
        <button onClick={send} disabled={loading||!input.trim()} aria-label="Send"><Send size={18}/></button>
      </div>
    </section>}
    <button className={"rag-fab "+(open?"open":"")} onClick={()=>setOpen((value)=>!value)} aria-label="Open RCLD ERP AI">
      {open?<X size={23}/>:<Bot size={25}/>}
      {!open && <span>AI</span>}
    </button>
  </>;
}
