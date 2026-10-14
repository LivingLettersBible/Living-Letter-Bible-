import { useState } from "react";
import type { GardenDesign } from "../../server/schema.ts";

interface Turn { role: "user" | "assistant"; content: string }

const STARTERS = [
  "What should I buy first?",
  "Which of these plants are safe for dogs?",
  "How do I prep the soil for the beds?",
  "Can I do this for half the budget?",
];

export function AskGardener({ design }: { design: GardenDesign }) {
  const [history, setHistory] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    const next: Turn[] = [...history, { role: "user", content: question }];
    setHistory(next);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, history, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setHistory([...next, { role: "assistant", content: data.answer }]);
    } catch (e) {
      setError((e as Error).message);
      setHistory(history);
      setDraft(question);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      {history.length === 0 && (
        <div className="starters">
          {STARTERS.map((s) => <button key={s} className="chip-btn" onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}
      <div className="chat-log">
        {history.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>{t.content}</div>
        ))}
        {busy && <div className="bubble assistant typing">Digging into that…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask anything about your new garden…" />
        <button className="primary" disabled={busy || !draft.trim()}>Ask</button>
      </form>
    </div>
  );
}
