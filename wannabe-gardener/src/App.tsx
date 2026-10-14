import { useEffect, useRef, useState } from "react";
import type { GardenDesign } from "../server/schema.ts";
import { BUDGETS, MAINTENANCE, SPACES, STYLES, SUN } from "./options.ts";
import { ResultView } from "./components/ResultView.tsx";
import { GardenPlan } from "./components/GardenPlan.tsx";

interface Saved { id: string; createdAt: number; style: string; photo: string | null; design: GardenDesign }

const SAVED_KEY = "wannabe-gardener:saved";
const LOADING_LINES = [
  "Reading the light in your photo…",
  "Sketching beds and paths…",
  "Choosing plants that won't die on you…",
  "Pricing it out at the garden centre…",
  "Writing your weekend-by-weekend plan…",
];

function loadSaved(): Saved[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"); } catch { return []; }
}
function persistSaved(items: Saved[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, 12))); } catch { /* storage full or blocked */ }
}

// Downscale before upload: keeps requests fast and fits in localStorage for the gallery.
async function shrinkImage(file: File, max = 1280): Promise<{ blob: Blob; dataUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const blob = await (await fetch(dataUrl)).blob();
  return { blob, dataUrl };
}

export default function App() {
  const [photo, setPhoto] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [style, setStyle] = useState(STYLES[0].id);
  const [space, setSpace] = useState(SPACES[0]);
  const [sun, setSun] = useState(SUN[0]);
  const [maintenance, setMaintenance] = useState(MAINTENANCE[1]);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [climate, setClimate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ design: GardenDesign; photo: string | null } | null>(null);
  const [saved, setSaved] = useState<Saved[]>(loadSaved);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 3500);
    return () => clearInterval(t);
  }, [loading]);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("That doesn't look like a photo."); return; }
    setError(null);
    try { setPhoto(await shrinkImage(file)); } catch { setError("Couldn't read that image. Try a JPEG or PNG."); }
  }

  async function generate() {
    if (!photo && !notes.trim()) { setError("Add a photo of your space, or describe it in the notes."); return; }
    setLoading(true); setLoadingLine(0); setError(null);
    const form = new FormData();
    if (photo) form.append("photo", photo.blob, "space.jpg");
    Object.entries({ style, space, sun, maintenance, budget, climate, notes }).forEach(([k, v]) => form.append(k, v));
    try {
      const res = await fetch("/api/design", { method: "POST", body: form });
      const data = await res.json().catch(() => ({ error: "The server sent back something unexpected." }));
      if (!res.ok) throw new Error(data.error ?? "Design failed");
      const design = data.design as GardenDesign;
      setResult({ design, photo: photo?.dataUrl ?? null });
      const entry: Saved = { id: crypto.randomUUID(), createdAt: Date.now(), style, photo: photo?.dataUrl ?? null, design };
      const next = [entry, ...saved];
      setSaved(next); persistSaved(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function removeSaved(id: string) {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next); persistSaved(next);
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setResult(null)}>
          <span className="logo" aria-hidden>🌿</span> Wannabe Gardener
        </button>
        <span className="topbar-note">AI garden design for beginners</span>
      </header>

      {result ? (
        <ResultView design={result.design} photo={result.photo} onRestart={() => setResult(null)} />
      ) : (
        <main>
          <section className="intro">
            <h1>Redesign your yard <em>in one photo.</em></h1>
            <p>Snap your backyard, balcony or patio. Pick a style. Get a plant-by-plant plan, a layout, a shopping list and a care calendar, written for people who've never kept anything alive.</p>
          </section>

          <section className="step">
            <h2><span className="num">1</span> Show us your space</h2>
            <div
              className={`dropzone ${dragging ? "drag" : ""} ${photo ? "has-photo" : ""}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInput.current?.click(); }}
            >
              {photo ? (
                <>
                  <img src={photo.dataUrl} alt="Your space" />
                  <button className="ghost small replace" onClick={(e) => { e.stopPropagation(); setPhoto(null); }}>Remove</button>
                </>
              ) : (
                <div className="drop-copy">
                  <span className="drop-icon" aria-hidden>📷</span>
                  <strong>Drop a photo or tap to upload</strong>
                  <span className="muted">Stand where you'd normally look out at it. Daylight works best.</span>
                </div>
              )}
              <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
            </div>
          </section>

          <section className="step">
            <h2><span className="num">2</span> Pick a style</h2>
            <div className="styles">
              {STYLES.map((s) => (
                <button key={s.id} className={`style-card ${style === s.id ? "selected" : ""}`} onClick={() => setStyle(s.id)} aria-pressed={style === s.id}>
                  <span className="style-art" style={{ ["--c1" as string]: s.colors[0], ["--c2" as string]: s.colors[1], ["--c3" as string]: s.colors[2] }} aria-hidden>
                    <i /><i /><i />
                  </span>
                  <strong>{s.name}</strong>
                  <span className="muted">{s.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="step">
            <h2><span className="num">3</span> Tell us a little more</h2>
            <div className="fields">
              <label>Space<select value={space} onChange={(e) => setSpace(e.target.value)}>{SPACES.map((o) => <option key={o}>{o}</option>)}</select></label>
              <label>Sunlight<select value={sun} onChange={(e) => setSun(e.target.value)}>{SUN.map((o) => <option key={o}>{o}</option>)}</select></label>
              <label>Upkeep<select value={maintenance} onChange={(e) => setMaintenance(e.target.value)}>{MAINTENANCE.map((o) => <option key={o}>{o}</option>)}</select></label>
              <label>Budget<select value={budget} onChange={(e) => setBudget(e.target.value)}>{BUDGETS.map((o) => <option key={o}>{o}</option>)}</select></label>
              <label className="wide">Where are you?<input value={climate} onChange={(e) => setClimate(e.target.value)} placeholder="City, ZIP or USDA zone — e.g. Portland, OR / zone 8b" /></label>
              <label className="wide">Anything else?<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Kids and a dog use the lawn, want a spot for morning coffee, hate mowing… (no photo? describe your space here)" /></label>
            </div>
          </section>

          {error && <p className="error">{error}</p>}

          <div className="cta">
            <button className="primary big" onClick={generate} disabled={loading}>
              {loading ? "Designing…" : "✨ Design my garden"}
            </button>
            {loading && <p className="loading-line" aria-live="polite">{LOADING_LINES[loadingLine]}</p>}
          </div>

          {saved.length > 0 && (
            <section className="gallery">
              <h2>Your designs</h2>
              <div className="gallery-grid">
                {saved.map((s) => (
                  <article key={s.id} className="gallery-card">
                    <button className="gallery-open" onClick={() => { setResult({ design: s.design, photo: s.photo }); window.scrollTo({ top: 0 }); }}>
                      <GardenPlan design={s.design} />
                      <strong>{s.design.title}</strong>
                      <span className="muted">{new Date(s.createdAt).toLocaleDateString()}</span>
                    </button>
                    <button className="ghost small" onClick={() => removeSaved(s.id)} aria-label={`Delete ${s.design.title}`}>Delete</button>
                  </article>
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      <footer className="footer">Plant suggestions are AI-generated — double-check hardiness and pet safety with your local nursery.</footer>
    </div>
  );
}
