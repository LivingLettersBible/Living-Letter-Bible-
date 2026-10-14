import { useState } from "react";
import type { GardenDesign } from "../../server/schema.ts";
import { GardenPlan, PlanLegend } from "./GardenPlan.tsx";
import { AskGardener } from "./AskGardener.tsx";

const TABS = ["Plan", "Plants", "Shopping list", "Build steps", "Care calendar", "Ask the gardener"] as const;
type Tab = (typeof TABS)[number];

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const SEASON_ICON = { spring: "🌱", summer: "☀️", autumn: "🍂", winter: "❄️" } as const;

export function ResultView({ design, photo, onRestart }: { design: GardenDesign; photo: string | null; onRestart: () => void }) {
  const [tab, setTab] = useState<Tab>("Plan");
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [compare, setCompare] = useState(50);
  const zoneName = (id: string) => design.zones.find((z) => z.id === id)?.name ?? id;

  return (
    <section className="result">
      <header className="result-head">
        <div>
          <p className="eyebrow">Your redesign · {design.difficulty}</p>
          <h2>{design.title}</h2>
          <p className="tagline">{design.tagline}</p>
        </div>
        <div className="result-actions">
          <button className="ghost" onClick={() => window.print()}>Print plan</button>
          <button className="ghost" onClick={onRestart}>New design</button>
        </div>
      </header>

      <div className="hero-compare">
        {photo ? (
          <div className="compare" style={{ ["--split" as string]: `${compare}%` }}>
            <img src={photo} alt="Your space before" className="compare-before" />
            <div className="compare-after"><GardenPlan design={design} /></div>
            <span className="compare-tag left">Before</span>
            <span className="compare-tag right">After</span>
            <input type="range" min={0} max={100} value={compare} onChange={(e) => setCompare(Number(e.target.value))}
              aria-label="Slide to compare before and after" />
          </div>
        ) : (
          <GardenPlan design={design} />
        )}
        <aside className="summary-card">
          <p>{design.summary}</p>
          <div className="palette">
            {design.palette.map((c) => (
              <div key={c.hex + c.name} className="swatch"><span style={{ background: c.hex }} />{c.name}</div>
            ))}
          </div>
          <dl className="stats">
            <div><dt>Plants</dt><dd>{design.plants.reduce((n, p) => n + p.quantity, 0)}</dd></div>
            <div><dt>Weekends</dt><dd>{Math.max(1, ...design.steps.map((s) => s.weekend))}</dd></div>
            <div><dt>Budget</dt><dd>{usd(design.budget.totalUSD)}</dd></div>
          </dl>
        </aside>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === "Plan" && (
          <div className="plan-grid">
            <div>
              <GardenPlan design={design} highlight={hoverZone} onHover={setHoverZone} />
              <PlanLegend />
            </div>
            <div>
              <h3>Zones</h3>
              <ul className="zone-list">
                {design.zones.map((z) => (
                  <li key={z.id} className={hoverZone === z.id ? "active" : ""} onMouseEnter={() => setHoverZone(z.id)} onMouseLeave={() => setHoverZone(null)}>
                    <strong>{z.name}</strong> <span className="chip">{z.kind}</span>
                    <p>{z.notes}</p>
                  </li>
                ))}
              </ul>
              <h3>What we saw</h3>
              <p className="muted">{design.siteAnalysis.sunlight}</p>
              <ul className="bullets">{design.siteAnalysis.observations.map((o) => <li key={o}>{o}</li>)}</ul>
              <div className="two-col">
                <div><h4>Challenges</h4><ul className="bullets">{design.siteAnalysis.challenges.map((o) => <li key={o}>{o}</li>)}</ul></div>
                <div><h4>Opportunities</h4><ul className="bullets">{design.siteAnalysis.opportunities.map((o) => <li key={o}>{o}</li>)}</ul></div>
              </div>
            </div>
          </div>
        )}

        {tab === "Plants" && (
          <div className="plant-grid">
            {design.plants.map((p) => (
              <article key={p.botanicalName + p.zoneId} className="plant-card">
                <header>
                  <div>
                    <h4>{p.commonName}</h4>
                    <em>{p.botanicalName}</em>
                  </div>
                  <span className={`chip role-${p.role}`}>{p.role}</span>
                </header>
                <p>{p.whyItWorks}</p>
                <dl>
                  <div><dt>Where</dt><dd>{zoneName(p.zoneId)} × {p.quantity}</dd></div>
                  <div><dt>Blooms</dt><dd>{p.bloomSeason}</dd></div>
                  <div><dt>Sun</dt><dd>{p.sun}</dd></div>
                  <div><dt>Water</dt><dd>{p.water}</dd></div>
                  <div><dt>Size</dt><dd>{p.matureSize}</dd></div>
                  <div><dt>Cost</dt><dd>{usd(p.estCostUSD)}</dd></div>
                </dl>
                <p className="tip">💡 {p.beginnerTip}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "Shopping list" && (
          <div className="shopping">
            <table>
              <thead><tr><th></th><th>Item</th><th>Qty</th><th>Est.</th></tr></thead>
              <tbody>
                {design.plants.map((p) => (
                  <tr key={p.botanicalName + p.zoneId}><td><input type="checkbox" aria-label={`Bought ${p.commonName}`} /></td>
                    <td>{p.commonName} <span className="muted">({p.botanicalName})</span></td><td>{p.quantity}</td><td>{usd(p.estCostUSD)}</td></tr>
                ))}
                {design.hardscape.map((h) => (
                  <tr key={h.item}><td><input type="checkbox" aria-label={`Bought ${h.item}`} /></td>
                    <td>{h.item} <span className="muted">— {h.notes}</span></td><td>—</td><td>{usd(h.estCostUSD)}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td></td><td>Plants</td><td></td><td>{usd(design.budget.plantsUSD)}</td></tr>
                <tr><td></td><td>Materials</td><td></td><td>{usd(design.budget.materialsUSD)}</td></tr>
                <tr className="total"><td></td><td>Total</td><td></td><td>{usd(design.budget.totalUSD)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === "Build steps" && (
          <ol className="steps">
            {design.steps.map((s, i) => (
              <li key={i}>
                <span className="weekend">Weekend {s.weekend}</span>
                <h4>{s.title}</h4>
                <p>{s.detail}</p>
              </li>
            ))}
          </ol>
        )}

        {tab === "Care calendar" && (
          <div className="seasons">
            {design.careCalendar.map((c) => (
              <div key={c.season} className={`season ${c.season}`}>
                <h4>{SEASON_ICON[c.season]} {c.season}</h4>
                <ul className="bullets">{c.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        )}

        {tab === "Ask the gardener" && <AskGardener design={design} />}
      </div>
    </section>
  );
}
