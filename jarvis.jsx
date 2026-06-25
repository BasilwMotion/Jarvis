import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS & CONFIG ────────────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const PERSONAS = {
  assistant: {
    name: "JARVIS",
    color: "#00d4ff",
    prompt: `You are JARVIS (Just A Rather Very Intelligent System), the AI assistant from Iron Man. You are highly intelligent, witty, slightly formal but personable, and extremely capable. You assist with any task: coding, research, writing, analysis, planning, and more. Keep responses concise but comprehensive. Use markdown formatting when helpful. Address the user as "sir" or "ma'am" occasionally for style.`,
  },
  researcher: {
    name: "RESEARCHER",
    color: "#a855f7",
    prompt: `You are JARVIS in Research Mode. You are a meticulous research assistant. Provide thorough, well-structured research with sources cited (note: you cannot access real-time web, so note this limitation). Use bullet points, headers, and structured data. Always mention caveats and knowledge cutoffs.`,
  },
  coder: {
    name: "DEV MODE",
    color: "#22c55e",
    prompt: `You are JARVIS in Developer Mode. You are an expert software engineer. Write clean, production-ready code with comments. Use proper code blocks with language tags. Explain what the code does after providing it. Ask clarifying questions when requirements are ambiguous.`,
  },
  creative: {
    name: "CREATIVE",
    color: "#f59e0b",
    prompt: `You are JARVIS in Creative Mode. You are a creative writer, copywriter, and content creator. Help with writing, storytelling, marketing copy, scripts, poems, and creative content. Be imaginative and tailor your style to the user's needs.`,
  },
};

const QUICK_ACTIONS = [
  { icon: "⚡", label: "Summarize", prompt: "Summarize the following text for me: " },
  { icon: "💡", label: "Brainstorm", prompt: "Brainstorm 10 ideas about: " },
  { icon: "📝", label: "Draft Email", prompt: "Draft a professional email about: " },
  { icon: "🔍", label: "Explain", prompt: "Explain this concept simply: " },
  { icon: "🐛", label: "Debug Code", prompt: "Debug this code and explain the issue:\n```\n\n```" },
  { icon: "📊", label: "Analyze", prompt: "Analyze this data and give insights: " },
];

const SAMPLE_TASKS = [
  { id: 1, title: "Review Q4 report", priority: "high", done: false, created: "2 hours ago" },
  { id: 2, title: "Schedule team meeting", priority: "medium", done: false, created: "5 hours ago" },
  { id: 3, title: "Update API documentation", priority: "low", done: true, created: "1 day ago" },
  { id: 4, title: "Deploy new feature branch", priority: "high", done: false, created: "3 hours ago" },
];

const AUTOMATIONS = [
  { id: 1, name: "Daily Briefing", trigger: "Every morning at 8AM", action: "Generate daily summary", active: true },
  { id: 2, name: "Smart Replies", trigger: "New task created", action: "Suggest next steps via AI", active: true },
  { id: 3, name: "Code Review", trigger: "On code paste", action: "Auto-analyze and suggest improvements", active: false },
];

// ─── PARTICLE BACKGROUND ─────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const particles = [];
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.5 + 0.1,
        color: ["#00d4ff", "#a855f7", "#6366f1"][Math.floor(Math.random() * 3)],
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.a * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach((b) => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(0,212,255,${0.08 * (1 - d / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ─── TYPING INDICATOR ────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 0" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#00d4ff",
          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ─── MARKDOWN RENDERER ───────────────────────────────────────────────────────
function MarkdownText({ text }) {
  const renderLine = (line, idx) => {
    if (line.startsWith("### ")) return <h3 key={idx} style={{ color: "#00d4ff", margin: "10px 0 4px", fontSize: 14 }}>{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={idx} style={{ color: "#00d4ff", margin: "12px 0 6px", fontSize: 16 }}>{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={idx} style={{ color: "#00d4ff", margin: "14px 0 8px", fontSize: 18 }}>{line.slice(2)}</h1>;
    if (line.startsWith("- ") || line.startsWith("* ")) return (
      <div key={idx} style={{ display: "flex", gap: 8, margin: "3px 0" }}>
        <span style={{ color: "#00d4ff", flexShrink: 0 }}>▸</span>
        <span style={{ color: "#c8d8e8" }}>{renderInline(line.slice(2))}</span>
      </div>
    );
    if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)[1];
      return (
        <div key={idx} style={{ display: "flex", gap: 8, margin: "3px 0" }}>
          <span style={{ color: "#a855f7", flexShrink: 0, minWidth: 20 }}>{num}.</span>
          <span style={{ color: "#c8d8e8" }}>{renderInline(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    }
    if (line === "") return <div key={idx} style={{ height: 6 }} />;
    return <div key={idx} style={{ color: "#c8d8e8", lineHeight: 1.6, margin: "2px 0" }}>{renderInline(line)}</div>;
  };

  const renderInline = (text) => {
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ color: "#e2e8f0" }}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={i} style={{ color: "#a5b4fc" }}>{part.slice(1, -1)}</em>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff", padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>{part.slice(1, -1)}</code>;
      return part;
    });
  };

  // Handle code blocks
  const blocks = [];
  let inCode = false, codeLang = "", codeLines = [], textLines = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line.startsWith("```")) {
      if (!inCode) {
        if (textLines.length) { blocks.push({ type: "text", lines: [...textLines] }); textLines = []; }
        inCode = true; codeLang = line.slice(3) || "code"; codeLines = [];
      } else {
        blocks.push({ type: "code", lang: codeLang, lines: [...codeLines] }); inCode = false; codeLang = "";
      }
    } else if (inCode) codeLines.push(line);
    else textLines.push(line);
  });
  if (textLines.length) blocks.push({ type: "text", lines: textLines });
  if (codeLines.length) blocks.push({ type: "code", lang: codeLang, lines: codeLines });

  return (
    <div>
      {blocks.map((block, bi) =>
        block.type === "code" ? (
          <div key={bi} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, margin: "8px 0", overflow: "hidden" }}>
            <div style={{ padding: "4px 12px", background: "rgba(0,212,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#00d4ff", fontSize: 11, fontFamily: "monospace" }}>{block.lang}</span>
              <button onClick={() => navigator.clipboard?.writeText(block.lines.join("\n"))} style={{ background: "none", border: "none", color: "#667", fontSize: 11, cursor: "pointer", padding: "2px 6px" }}>copy</button>
            </div>
            <pre style={{ margin: 0, padding: "12px", overflowX: "auto", color: "#a5f3fc", fontSize: 12, lineHeight: 1.6, fontFamily: "monospace" }}>{block.lines.join("\n")}</pre>
          </div>
        ) : (
          <div key={bi}>{block.lines.map((l, li) => renderLine(l, li))}</div>
        )
      )}
    </div>
  );
}

// ─── VOICE BUTTON ────────────────────────────────────────────────────────────
function VoiceButton({ onResult, disabled }) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const supported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const toggle = () => {
    if (!supported) { alert("Speech recognition not supported in this browser."); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { onResult(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    r.start(); setListening(true);
  };
  return (
    <button onClick={toggle} disabled={disabled} title={listening ? "Stop listening" : "Voice input"} style={{
      background: listening ? "rgba(239,68,68,0.2)" : "rgba(0,212,255,0.1)",
      border: `1px solid ${listening ? "rgba(239,68,68,0.5)" : "rgba(0,212,255,0.3)"}`,
      color: listening ? "#ef4444" : "#00d4ff",
      borderRadius: 8, padding: "10px 12px", cursor: "pointer",
      fontSize: 16, lineHeight: 1, transition: "all 0.2s",
      animation: listening ? "pulse-ring 1s ease-in-out infinite" : "none",
    }}>
      {listening ? "🔴" : "🎤"}
    </button>
  );
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#`]/g, "").slice(0, 500);
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 1.05; utt.pitch = 0.9; utt.volume = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const pref = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en")) || voices.find(v => v.lang.startsWith("en"));
  if (pref) utt.voice = pref;
  window.speechSynthesis.speak(utt);
}

// ─── API CALL ─────────────────────────────────────────────────────────────────
async function callGemini(apiKey, messages, systemPrompt, onChunk) {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 2048 },
  };

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) { full += text; onChunk(full); }
        } catch {}
      }
    }
  }
  return full;
}

// ─── PANEL: CHAT ──────────────────────────────────────────────────────────────
function ChatPanel({ apiKey, persona }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Systems online. I am JARVIS — your personal AI assistant. How may I assist you today, sir?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const bottomRef = useRef(null);
  const p = PERSONAS[persona];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading || !apiKey) return;
    setInput("");
    const newMsgs = [...messages, { role: "user", content: q }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const history = newMsgs.slice(-12);
      let streaming = "";
      setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);
      await callGemini(apiKey, history, p.prompt, (chunk) => {
        streaming = chunk;
        setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: chunk } : m));
      });
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
      if (ttsEnabled && streaming) speak(streaming);
    } catch (e) {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: `⚠️ Error: ${e.message}. Please check your API key and try again.` }]);
    }
    setLoading(false);
  }, [input, messages, loading, apiKey, p.prompt, ttsEnabled]);

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, boxShadow: `0 0 8px ${p.color}` }} />
          <span style={{ color: p.color, fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>{p.name}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setTtsEnabled(t => !t)} style={{ background: ttsEnabled ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${ttsEnabled ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.1)"}`, color: ttsEnabled ? "#00d4ff" : "#556", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }} title="Toggle voice output">
            {ttsEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
          </button>
          <button onClick={() => setMessages([{ role: "assistant", content: "Memory cleared. Ready for new directives, sir." }])} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>Clear</button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {QUICK_ACTIONS.map(a => (
          <button key={a.label} onClick={() => setInput(a.prompt)} style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)", color: "#8ab", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `radial-gradient(circle, ${p.color}33, transparent)`, border: `1px solid ${p.color}66`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 8, marginTop: 2, fontSize: 12 }}>J</div>
            )}
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
              background: m.role === "user" ? "rgba(99,102,241,0.2)" : "rgba(0,0,0,0.3)",
              border: m.role === "user" ? "1px solid rgba(99,102,241,0.3)" : `1px solid rgba(0,212,255,0.12)`,
              fontSize: 13, lineHeight: 1.6,
            }}>
              {m.role === "user" ? (
                <span style={{ color: "#e2e8f0" }}>{m.content}</span>
              ) : m.streaming && !m.content ? (
                <TypingDots />
              ) : (
                <>
                  <MarkdownText text={m.content} />
                  {m.streaming && <TypingDots />}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!apiKey && (
        <div style={{ padding: "8px 16px", background: "rgba(245,158,11,0.08)", borderTop: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", fontSize: 12, textAlign: "center" }}>
          ⚠️ Enter your Gemini API key in Settings to activate JARVIS
        </div>
      )}
      <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(0,212,255,0.1)", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder={apiKey ? "Command JARVIS..." : "API key required..."} disabled={!apiKey || loading}
          style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 10, padding: "10px 14px", color: "#e2e8f0", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5, minHeight: 44, maxHeight: 120 }}
          rows={1} onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
        />
        <VoiceButton onResult={(t) => { setInput(t); setTimeout(() => send(t), 100); }} disabled={!apiKey || loading} />
        <button onClick={() => send()} disabled={!input.trim() || !apiKey || loading} style={{
          background: input.trim() && apiKey ? "linear-gradient(135deg, #00d4ff22, #6366f122)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${input.trim() && apiKey ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.1)"}`,
          color: input.trim() && apiKey ? "#00d4ff" : "#445", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 14, transition: "all 0.2s",
        }}>➤</button>
      </div>
    </div>
  );
}

// ─── PANEL: TASKS ─────────────────────────────────────────────────────────────
function TaskPanel({ apiKey }) {
  const [tasks, setTasks] = useState(SAMPLE_TASKS);
  const [newTask, setNewTask] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiOutput, setAiOutput] = useState("");

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(t => [...t, { id: Date.now(), title: newTask, priority: "medium", done: false, created: "Just now" }]);
    setNewTask("");
  };

  const toggle = (id) => setTasks(t => t.map(task => task.id === id ? { ...task, done: !task.done } : task));
  const remove = (id) => setTasks(t => t.filter(task => task.id !== id));

  const aiPrioritize = async () => {
    if (!apiKey) return;
    setAiSuggesting(true); setAiOutput("");
    const taskList = tasks.filter(t => !t.done).map(t => t.title).join(", ");
    try {
      await callGemini(apiKey, [{ role: "user", content: `Prioritize these tasks and give brief reasoning: ${taskList}` }],
        "You are a productivity AI. Be concise and practical.", (chunk) => setAiOutput(chunk));
    } catch (e) { setAiOutput("Error: " + e.message); }
    setAiSuggesting(false);
  };

  const prioColor = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Add a task..." style={{ flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        <button onClick={addTask} style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>+</button>
        <button onClick={aiPrioritize} disabled={!apiKey || aiSuggesting} style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12 }}>
          {aiSuggesting ? "..." : "✨ AI Sort"}
        </button>
      </div>

      {aiOutput && (
        <div style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 10, padding: 12, fontSize: 12 }}>
          <div style={{ color: "#a855f7", fontWeight: 700, marginBottom: 6 }}>JARVIS Recommendation</div>
          <MarkdownText text={aiOutput} />
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {["All", "Active", "Done"].map(f => (
          <button key={f} style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)", color: "#8ab", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>{f}</button>
        ))}
        <span style={{ color: "#556", fontSize: 11, marginLeft: "auto", alignSelf: "center" }}>{tasks.filter(t => !t.done).length} pending</span>
      </div>

      {tasks.map(task => (
        <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: task.done ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.25)", border: `1px solid ${task.done ? "rgba(255,255,255,0.04)" : "rgba(0,212,255,0.1)"}`, borderRadius: 10, transition: "all 0.2s" }}>
          <button onClick={() => toggle(task.id)} style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${task.done ? "#22c55e" : "rgba(0,212,255,0.4)"}`, background: task.done ? "#22c55e22" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#22c55e", fontSize: 10 }}>
            {task.done ? "✓" : ""}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: task.done ? "#445" : "#c8d8e8", fontSize: 13, textDecoration: task.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
            <div style={{ color: "#445", fontSize: 10, marginTop: 2 }}>{task.created}</div>
          </div>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: prioColor[task.priority], flexShrink: 0 }} title={task.priority} />
          <button onClick={() => remove(task.id)} style={{ background: "none", border: "none", color: "#445", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── PANEL: AUTOMATIONS ──────────────────────────────────────────────────────
function AutomationPanel({ apiKey }) {
  const [automations, setAutomations] = useState(AUTOMATIONS);
  const [building, setBuilding] = useState(false);
  const [form, setForm] = useState({ name: "", trigger: "", action: "" });
  const [aiHelp, setAiHelp] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  const toggle = (id) => setAutomations(a => a.map(x => x.id === id ? { ...x, active: !x.active } : x));
  const save = () => {
    if (!form.name || !form.trigger || !form.action) return;
    setAutomations(a => [...a, { ...form, id: Date.now(), active: true }]);
    setForm({ name: "", trigger: "", action: "" }); setBuilding(false);
  };

  const getSuggestions = async () => {
    if (!apiKey) return;
    setLoadingAi(true); setAiHelp("");
    try {
      await callGemini(apiKey, [{ role: "user", content: "Suggest 5 useful workflow automations for a professional using an AI assistant. Format each as: Name | Trigger | Action" }],
        "You are a productivity expert. Be concise and practical.", (c) => setAiHelp(c));
    } catch (e) { setAiHelp("Error: " + e.message); }
    setLoadingAi(false);
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setBuilding(!building)} style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12 }}>+ New Automation</button>
        <button onClick={getSuggestions} disabled={!apiKey || loadingAi} style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12 }}>
          {loadingAi ? "..." : "✨ AI Ideas"}
        </button>
      </div>

      {building && (
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ color: "#00d4ff", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>WORKFLOW BUILDER</div>
          {[["name", "Automation name..."], ["trigger", "WHEN: trigger event..."], ["action", "THEN: action to take..."]].map(([k, ph]) => (
            <input key={k} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph}
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 12 }}>Save</button>
            <button onClick={() => setBuilding(false)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {aiHelp && (
        <div style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 10, padding: 12, fontSize: 12 }}>
          <div style={{ color: "#a855f7", fontWeight: 700, marginBottom: 6 }}>AI-Suggested Automations</div>
          <MarkdownText text={aiHelp} />
        </div>
      )}

      {automations.map(a => (
        <div key={a.id} style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${a.active ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.05)"}`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: a.active ? "#e2e8f0" : "#445", fontWeight: 600, fontSize: 13 }}>{a.name}</span>
            <button onClick={() => toggle(a.id)} style={{ background: a.active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${a.active ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)"}`, color: a.active ? "#22c55e" : "#556", borderRadius: 20, padding: "2px 10px", cursor: "pointer", fontSize: 11 }}>
              {a.active ? "ON" : "OFF"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
            <span style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", borderRadius: 4, padding: "2px 7px" }}>WHEN</span>
            <span style={{ color: "#8ab" }}>{a.trigger}</span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, marginTop: 5 }}>
            <span style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", color: "#00d4ff", borderRadius: 4, padding: "2px 7px" }}>THEN</span>
            <span style={{ color: "#8ab" }}>{a.action}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PANEL: APPS ──────────────────────────────────────────────────────────────
function AppsPanel() {
  const apps = [
    { name: "Gmail", icon: "✉️", color: "#ea4335", status: "connect" },
    { name: "Google Cal", icon: "📅", color: "#4285f4", status: "connect" },
    { name: "Slack", icon: "💬", color: "#4a154b", status: "connect" },
    { name: "GitHub", icon: "🐙", color: "#24292e", status: "connect" },
    { name: "Notion", icon: "📝", color: "#000", status: "connect" },
    { name: "Trello", icon: "📋", color: "#0052cc", status: "connect" },
    { name: "Discord", icon: "🎮", color: "#5865f2", status: "connect" },
    { name: "Stripe", icon: "💳", color: "#635bff", status: "connect" },
    { name: "Dropbox", icon: "📦", color: "#0061ff", status: "connect" },
    { name: "LinkedIn", icon: "🔗", color: "#0077b5", status: "connect" },
    { name: "WhatsApp", icon: "📱", color: "#25d366", status: "connect" },
    { name: "Salesforce", icon: "☁️", color: "#00a1e0", status: "connect" },
  ];
  const [connected, setConnected] = useState(new Set());

  return (
    <div style={{ padding: 16, height: "100%", overflowY: "auto" }}>
      <div style={{ color: "#667", fontSize: 11, marginBottom: 12 }}>Connect your favorite apps to unlock JARVIS integrations. OAuth authentication required.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
        {apps.map(app => {
          const isConn = connected.has(app.name);
          return (
            <div key={app.name} style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${isConn ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 24 }}>{app.icon}</span>
              <span style={{ color: "#c8d8e8", fontSize: 12, fontWeight: 600 }}>{app.name}</span>
              <button onClick={() => setConnected(s => { const n = new Set(s); isConn ? n.delete(app.name) : n.add(app.name); return n; })}
                style={{ background: isConn ? "rgba(34,197,94,0.1)" : "rgba(0,212,255,0.08)", border: `1px solid ${isConn ? "rgba(34,197,94,0.3)" : "rgba(0,212,255,0.2)"}`, color: isConn ? "#22c55e" : "#00d4ff", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11, width: "100%" }}>
                {isConn ? "✓ Connected" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PANEL: FILE ANALYZER ────────────────────────────────────────────────────
function FilePanel({ apiKey }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("summarize");

  const loadFile = async (f) => {
    setFile(f); setAnswer(""); setText("");
    if (f.type === "text/plain" || f.name.endsWith(".txt") || f.name.endsWith(".csv") || f.name.endsWith(".md")) {
      const t = await f.text(); setText(t.slice(0, 8000));
    } else if (f.type === "application/json") {
      const t = await f.text(); setText(t.slice(0, 8000));
    } else {
      setText(`[Binary file: ${f.name} (${(f.size / 1024).toFixed(1)} KB) — JARVIS can analyze text-based files. For PDFs and DOCX, please convert to .txt first.]`);
    }
  };

  const analyze = async () => {
    if (!apiKey || !text) return;
    setLoading(true); setAnswer("");
    const prompts = {
      summarize: `Summarize this document concisely:\n\n${text.slice(0, 6000)}`,
      extract: `Extract all key information, facts, and data points from this document:\n\n${text.slice(0, 6000)}`,
      question: `Based on this document:\n\n${text.slice(0, 5000)}\n\nAnswer this question: ${question}`,
      report: `Generate a structured analysis report for this document:\n\n${text.slice(0, 6000)}`,
    };
    try {
      await callGemini(apiKey, [{ role: "user", content: prompts[mode] }], PERSONAS.researcher.prompt, (c) => setAnswer(c));
    } catch (e) { setAnswer("Error: " + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%", overflowY: "auto" }}>
      <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
        style={{ border: "2px dashed rgba(0,212,255,0.25)", borderRadius: 12, padding: "20px", textAlign: "center", cursor: "pointer", background: "rgba(0,212,255,0.03)", position: "relative" }}>
        <input type="file" onChange={e => e.target.files[0] && loadFile(e.target.files[0])} accept=".txt,.csv,.md,.json,.js,.py,.html,.css" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
        <div style={{ fontSize: 28 }}>📁</div>
        <div style={{ color: "#8ab", fontSize: 13, marginTop: 4 }}>{file ? file.name : "Drop or click to upload"}</div>
        <div style={{ color: "#445", fontSize: 11, marginTop: 2 }}>TXT, CSV, JSON, MD, code files</div>
      </div>

      {text && (
        <>
          <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 10, maxHeight: 100, overflowY: "auto", fontSize: 11, color: "#667", fontFamily: "monospace", border: "1px solid rgba(255,255,255,0.05)" }}>
            {text.slice(0, 500)}{text.length > 500 ? "..." : ""}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[["summarize", "📋 Summarize"], ["extract", "🔍 Extract"], ["report", "📊 Report"], ["question", "❓ Ask"]].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{ background: mode === m ? "rgba(0,212,255,0.15)" : "rgba(0,0,0,0.2)", border: `1px solid ${mode === m ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`, color: mode === m ? "#00d4ff" : "#667", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>{label}</button>
            ))}
          </div>

          {mode === "question" && (
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question about the file..." style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
          )}

          <button onClick={analyze} disabled={loading || !apiKey} style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff", borderRadius: 8, padding: "10px", cursor: "pointer", fontSize: 13 }}>
            {loading ? "Analyzing..." : "⚡ Analyze with JARVIS"}
          </button>
        </>
      )}

      {answer && (
        <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 10, padding: 14, fontSize: 12 }}>
          <div style={{ color: "#00d4ff", fontWeight: 700, marginBottom: 8 }}>ANALYSIS RESULT</div>
          <MarkdownText text={answer} />
        </div>
      )}
    </div>
  );
}

// ─── PANEL: SETTINGS ──────────────────────────────────────────────────────────
function SettingsPanel({ apiKey, setApiKey, persona, setPersona }) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  const testKey = async () => {
    if (!inputKey) return;
    setTesting(true); setTestResult("");
    try {
      await callGemini(inputKey, [{ role: "user", content: "Reply with exactly: JARVIS ONLINE" }], "You are JARVIS.", () => {});
      setTestResult("✅ API key verified. JARVIS is online.");
      setApiKey(inputKey);
    } catch (e) { setTestResult("❌ " + e.message); }
    setTesting(false);
  };

  const save = () => { setApiKey(inputKey); setTestResult("✅ Key saved."); };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, height: "100%", overflowY: "auto" }}>
      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 12, padding: 16 }}>
        <div style={{ color: "#00d4ff", fontWeight: 700, fontSize: 13, letterSpacing: 1, marginBottom: 12 }}>🔑 GEMINI API KEY</div>
        <div style={{ color: "#667", fontSize: 11, marginBottom: 10 }}>
          Get your free API key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: "#00d4ff" }}>aistudio.google.com</a>. Free tier includes 15 req/min, 1M tokens/day.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="password" value={inputKey} onChange={e => setInputKey(e.target.value)} placeholder="AIza..."
            style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "monospace" }} />
          <button onClick={save} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12 }}>Save</button>
          <button onClick={testKey} disabled={testing} style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12 }}>
            {testing ? "..." : "Test"}
          </button>
        </div>
        {testResult && <div style={{ marginTop: 8, fontSize: 12, color: testResult.startsWith("✅") ? "#22c55e" : "#ef4444" }}>{testResult}</div>}
      </div>

      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 12, padding: 16 }}>
        <div style={{ color: "#a855f7", fontWeight: 700, fontSize: 13, letterSpacing: 1, marginBottom: 12 }}>🤖 AI PERSONA</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(PERSONAS).map(([key, p]) => (
            <button key={key} onClick={() => setPersona(key)} style={{ background: persona === key ? `${p.color}18` : "rgba(0,0,0,0.2)", border: `1px solid ${persona === key ? p.color + "55" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
              <div style={{ color: persona === key ? p.color : "#c8d8e8", fontWeight: 700, fontSize: 12 }}>{p.name}</div>
              <div style={{ color: "#445", fontSize: 10, marginTop: 3 }}>{p.prompt.slice(40, 90)}...</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16 }}>
        <div style={{ color: "#667", fontWeight: 700, fontSize: 13, letterSpacing: 1, marginBottom: 10 }}>ℹ️ SYSTEM INFO</div>
        {[
          ["Model", "Gemini 2.0 Flash"],
          ["Interface", "JARVIS v2.0"],
          ["Voice Input", "Web Speech API"],
          ["Voice Output", "Speech Synthesis API"],
          ["Storage", "Session Memory"],
          ["Status", apiKey ? "🟢 Online" : "🔴 API Key Required"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12 }}>
            <span style={{ color: "#556" }}>{k}</span>
            <span style={{ color: "#8ab" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PANEL: ANALYTICS ────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const stats = [
    { label: "Messages Today", value: "47", delta: "+12%", color: "#00d4ff" },
    { label: "Tasks Completed", value: "8/12", delta: "67%", color: "#22c55e" },
    { label: "Files Analyzed", value: "3", delta: "New", color: "#a855f7" },
    { label: "Automations Run", value: "14", delta: "Active", color: "#f59e0b" },
  ];
  const usage = [30, 55, 40, 70, 85, 60, 92, 75, 50, 65, 80, 45];

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "rgba(0,0,0,0.25)", border: `1px solid ${s.color}22`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ color: "#556", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>{s.label.toUpperCase()}</div>
            <div style={{ color: s.color, fontSize: 22, fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: "#445", fontSize: 10, marginTop: 2 }}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: 12, padding: 16 }}>
        <div style={{ color: "#667", fontSize: 11, marginBottom: 12, letterSpacing: 1 }}>24H ACTIVITY</div>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 60 }}>
          {usage.map((v, i) => (
            <div key={i} style={{ flex: 1, background: `linear-gradient(to top, #00d4ff44, #00d4ff11)`, borderRadius: "3px 3px 0 0", height: `${v}%`, border: "1px solid rgba(0,212,255,0.2)", borderBottom: "none", transition: "all 0.3s", cursor: "default" }} title={`${v}%`} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#334", fontSize: 9, marginTop: 4 }}>
          {["12a","","","3a","","","6a","","","9a","","12p"].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 14 }}>
        <div style={{ color: "#667", fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>RECENT ACTIVITY</div>
        {[
          { icon: "💬", text: "Chat session: Code review assistance", time: "2m ago" },
          { icon: "✅", text: "Task completed: Deploy feature branch", time: "15m ago" },
          { icon: "⚡", text: "Automation triggered: Daily Briefing", time: "2h ago" },
          { icon: "📁", text: "File analyzed: Q4_report.txt", time: "3h ago" },
        ].map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.03)" : "none" }}>
            <span style={{ fontSize: 14 }}>{a.icon}</span>
            <span style={{ flex: 1, color: "#8ab", fontSize: 11 }}>{a.text}</span>
            <span style={{ color: "#334", fontSize: 10 }}>{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function JARVIS() {
  const [apiKey, setApiKey] = useState(() => localStorage?.getItem?.("jarvis_gemini_key") || "");
  const [persona, setPersona] = useState("assistant");
  const [activeTab, setActiveTab] = useState("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications] = useState(3);
  const [time, setTime] = useState(new Date());

  // Persist key
  useEffect(() => { if (apiKey) localStorage?.setItem?.("jarvis_gemini_key", apiKey); }, [apiKey]);

  // Clock
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const tabs = [
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "tasks", icon: "✅", label: "Tasks" },
    { id: "automate", icon: "⚡", label: "Automate" },
    { id: "apps", icon: "🔌", label: "Apps" },
    { id: "files", icon: "📁", label: "Files" },
    { id: "analytics", icon: "📊", label: "Analytics" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  const p = PERSONAS[persona];

  return (
    <div style={{ minHeight: "100vh", background: "#030b14", color: "#e2e8f0", fontFamily: "'Inter', -apple-system, sans-serif", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.2); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
        @keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,0)} }
        @keyframes glow-pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes slide-in { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
        .nav-btn:hover { background: rgba(0,212,255,0.1) !important; }
        .tab-btn:hover { background: rgba(0,212,255,0.08) !important; }
      `}</style>

      <ParticleCanvas />

      {/* ── HEADER ── */}
      <header style={{ position: "relative", zIndex: 10, borderBottom: "1px solid rgba(0,212,255,0.12)", background: "rgba(3,11,20,0.85)", backdropFilter: "blur(20px)", padding: "0 20px", height: 56, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #00d4ff22, #6366f122)", border: "1px solid rgba(0,212,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>J</div>
          <div>
            <div style={{ color: "#00d4ff", fontWeight: 800, fontSize: 15, letterSpacing: 3, lineHeight: 1 }}>JARVIS</div>
            <div style={{ color: "#334", fontSize: 9, letterSpacing: 1 }}>AI COMMAND CENTER</div>
          </div>
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: apiKey ? "#22c55e" : "#ef4444", animation: "glow-pulse 2s ease infinite", boxShadow: `0 0 6px ${apiKey ? "#22c55e" : "#ef4444"}` }} />
          <span style={{ color: apiKey ? "#22c55e" : "#ef4444", fontSize: 10, letterSpacing: 1 }}>{apiKey ? "ONLINE" : "OFFLINE"}</span>
        </div>

        {/* Persona badge */}
        <div style={{ background: `${p.color}18`, border: `1px solid ${p.color}44`, borderRadius: 20, padding: "3px 10px", fontSize: 10, color: p.color, letterSpacing: 1, fontWeight: 700 }}>{p.name}</div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Clock */}
        <div style={{ color: "#556", fontSize: 12, fontFamily: "monospace", letterSpacing: 1 }}>
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <button className="nav-btn" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#8ab", fontSize: 14 }}>🔔</button>
          {notifications > 0 && <div style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, background: "#ef4444", borderRadius: "50%", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{notifications}</div>}
        </div>

        {/* Sidebar toggle */}
        <button className="nav-btn" onClick={() => setSidebarOpen(s => !s)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#8ab", fontSize: 14 }}>
          {sidebarOpen ? "◀" : "▶"}
        </button>
      </header>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", zIndex: 5 }}>
        {/* ── SIDEBAR ── */}
        <aside style={{ width: sidebarOpen ? 200 : 0, overflow: "hidden", transition: "width 0.3s ease", flexShrink: 0, borderRight: "1px solid rgba(0,212,255,0.08)", background: "rgba(3,11,20,0.7)", backdropFilter: "blur(12px)" }}>
          <div style={{ width: 200, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
            {tabs.map(tab => (
              <button key={tab.id} className="tab-btn" onClick={() => setActiveTab(tab.id)} style={{
                background: activeTab === tab.id ? "rgba(0,212,255,0.1)" : "transparent",
                border: activeTab === tab.id ? "1px solid rgba(0,212,255,0.25)" : "1px solid transparent",
                color: activeTab === tab.id ? "#00d4ff" : "#556",
                borderRadius: 8, padding: "9px 12px", cursor: "pointer", textAlign: "left", fontSize: 13,
                display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s",
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}>
                <span style={{ fontSize: 15 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── MAIN PANEL ── */}
        <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", animation: "slide-in 0.25s ease" }}>
          {/* Panel header */}
          <div style={{ borderBottom: "1px solid rgba(0,212,255,0.08)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 16 }}>{tabs.find(t => t.id === activeTab)?.icon}</span>
            <span style={{ color: "#8ab", fontWeight: 600, fontSize: 13, letterSpacing: 2 }}>{tabs.find(t => t.id === activeTab)?.label.toUpperCase()}</span>
            {!sidebarOpen && (
              <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ background: activeTab === tab.id ? "rgba(0,212,255,0.1)" : "transparent", border: `1px solid ${activeTab === tab.id ? "rgba(0,212,255,0.3)" : "transparent"}`, color: activeTab === tab.id ? "#00d4ff" : "#445", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>{tab.icon}</button>
                ))}
              </div>
            )}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {activeTab === "chat" && <ChatPanel apiKey={apiKey} persona={persona} />}
            {activeTab === "tasks" && <TaskPanel apiKey={apiKey} />}
            {activeTab === "automate" && <AutomationPanel apiKey={apiKey} />}
            {activeTab === "apps" && <AppsPanel />}
            {activeTab === "files" && <FilePanel apiKey={apiKey} />}
            {activeTab === "analytics" && <AnalyticsPanel />}
            {activeTab === "settings" && <SettingsPanel apiKey={apiKey} setApiKey={setApiKey} persona={persona} setPersona={setPersona} />}
          </div>
        </main>
      </div>

      {/* ── FOOTER STATUS BAR ── */}
      <footer style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(0,212,255,0.08)", background: "rgba(3,11,20,0.85)", backdropFilter: "blur(10px)", padding: "4px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ color: "#223", fontSize: 10, letterSpacing: 1 }}>JARVIS AI COMMAND CENTER — POWERED BY GOOGLE GEMINI</div>
        <div style={{ display: "flex", gap: 16, color: "#223", fontSize: 10 }}>
          <span>v2.0.0</span>
          <span>●</span>
          <span style={{ color: apiKey ? "#22c55e44" : "#ef444444" }}>{apiKey ? "GEMINI CONNECTED" : "API KEY REQUIRED"}</span>
        </div>
      </footer>
    </div>
  );
}
