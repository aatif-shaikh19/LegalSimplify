// App.jsx
import React, { useState, useMemo } from "react";
import "./App.css";

// ---- Utility helpers ----
function splitSentences(text) {
  return text
    .replace(/\n/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'()])/)
    .map(s => s.trim())
    .filter(Boolean);
}

const LEGAL_MAP = [
  [/(force\s+majeure)/i, "unavoidable events (e.g., natural disaster)"],
  [/(indemnif(y|ies|ication))/i, "compensation if someone sues you"],
  [/(waiver)/i, "giving up a right intentionally"],
  [/(jurisdicti(on|onal))/i, "which court's rules apply"],
  [/(notwithstanding)/i, "despite the above"],
  [/(liabilit(y|ies))/i, "legal responsibility for harm"],
  [/(confidential(ity)?)/i, "kept private"],
  [/(termination)/i, "ending the agreement"]
];

function heuristicsSummary(text, maxPoints = 5) {
  const sents = splitSentences(text);
  if (sents.length === 0) return [];
  const keywords = [
    "obligation","shall","must","liability","termination",
    "confidential","indemnify","warranty","payment","fee",
    "notice","force majeure","dispute","governing law","breach"
  ];

  const scored = sents.map((sent, i) => {
    const l = sent.toLowerCase();
    let score = 0;
    keywords.forEach(k => { if (l.includes(k)) score += 3; });
    if (sent.length > 120) score += 1;
    if (sent.length > 250) score += 1;
    score += Math.max(0, 1 - i / Math.max(1, sents.length));
    return { sent, score, idx: i };
  });

  scored.sort((a,b) => b.score - a.score);
  const top = scored.slice(0, Math.min(maxPoints, scored.length));
  return top.map(({ sent }) => {
    let plain = sent;
    LEGAL_MAP.forEach(([re, replacement]) => {
      plain = plain.replace(re, match => `${match} (${replacement})`);
    });
    return plain;
  });
}

function simpleChatAnswer(question, original, summary) {
  const q = question.toLowerCase();
  if (!q.trim()) return "Please ask a question about the uploaded document.";

  if (q.includes("terminate")) {
    const s = splitSentences(original).filter(s => /terminate/i.test(s));
    return s.slice(0,3).join(" ") || "No explicit termination clause found.";
  }
  if (q.includes("payment") || q.includes("fee")) {
    const s = splitSentences(original).filter(s => /(payment|fee|price)/i.test(s));
    return s.slice(0,3).join(" ") || "No payment clause found.";
  }
  if (summary.length > 0) return summary.slice(0,2).join(" ");
  return "No relevant answer found.";
}

// ---- Main App ----
export default function App() {
  const [text, setText] = useState("");
  const [uploadedName, setUploadedName] = useState("");
  const [summaryPoints, setSummaryPoints] = useState([]);
  const [chatLog, setChatLog] = useState([]);
  const [q, setQ] = useState("");
  const [maxPoints, setMaxPoints] = useState(5);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadedName(f.name);
    const reader = new FileReader();
    reader.onload = ev => setText(String(ev.target.result));
    reader.readAsText(f);
  };

  const generateSummary = () => {
    setSummaryPoints(heuristicsSummary(text, Number(maxPoints)));
    setChatLog([]);
  };

  const handleAsk = () => {
    if (!q.trim()) return;
    const answer = simpleChatAnswer(q, text, summaryPoints);
    setChatLog(prev => [...prev, { q, a: answer }]);
    setQ("");
  };

  const risks = useMemo(() => {
    const riskKeywords = ["indemnify","liability","penalt","breach","terminate","obligation"];
    return splitSentences(text).filter(s => riskKeywords.some(k => s.toLowerCase().includes(k))).slice(0,6);
  }, [text]);

  return (
    <div className="app">
      <div className="container">
        <h1>LegalSimplify — Prototype</h1>
        <p className="subtitle">
          Upload or paste a legal document, simplify it, and ask quick questions.
        </p>

        <div className="grid">
          <div className="panel">
            <label>Document</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste contract text here..."
            />
            <input type="file" accept=".txt" onChange={handleFile} />
            <span>{uploadedName}</span>
          </div>

          <div className="panel">
            <label>Options</label>
            <input
              type="range"
              min={1}
              max={10}
              value={maxPoints}
              onChange={e => setMaxPoints(e.target.value)}
            />
            <div>{maxPoints} summary points</div>
            <button onClick={generateSummary}>Simplify</button>
          </div>
        </div>

        <div className="grid">
          <div className="panel">
            <h3>Original</h3>
            <div className="scrollbox">{text || "(No document uploaded)"}</div>
          </div>

          <div className="panel">
            <h3>Simplified Summary</h3>
            <ul>
              {summaryPoints.map((p,i)=><li key={i}>{p}</li>)}
            </ul>
          </div>

          <div className="panel">
            <h3>Chatbot</h3>
            <div className="chat-input">
              <input
                value={q}
                onChange={e=>setQ(e.target.value)}
                placeholder="Ask me anything..."
              />
              <button onClick={handleAsk}>Ask</button>
            </div>
            <div className="scrollbox">
              {chatLog.map((c,i)=>(
                <div key={i}>
                  <b>You:</b> {c.q}
                  <div className="chat-answer">{c.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Detected Risks</h3>
          <ul>
            {risks.map((r,i)=><li key={i}>{r}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
