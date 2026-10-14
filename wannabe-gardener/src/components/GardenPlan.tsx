import type { GardenDesign } from "../../server/schema.ts";

type Zone = GardenDesign["zones"][number];

const ZONE_FILL: Record<Zone["kind"], string> = {
  bed: "url(#p-bed)",
  lawn: "url(#p-lawn)",
  path: "url(#p-path)",
  patio: "url(#p-patio)",
  water: "url(#p-water)",
  tree: "var(--z-tree)",
  container: "var(--z-container)",
  vegetable: "url(#p-veg)",
  meadow: "url(#p-meadow)",
  seating: "var(--z-seating)",
};

const ROLE_COLOR: Record<GardenDesign["plants"][number]["role"], string> = {
  focal: "#d6457a",
  structure: "#2f6b45",
  filler: "#b39ddb",
  groundcover: "#8bc34a",
  climber: "#e9a23b",
  edible: "#e4572e",
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

// Deterministic pseudo-random so plant dots don't jump around on re-render.
function scatter(seed: string, i: number) {
  let h = 2166136261;
  for (const c of seed + i) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export function GardenPlan({ design, highlight, onHover }: {
  design: GardenDesign;
  highlight?: string | null;
  onHover?: (zoneId: string | null) => void;
}) {
  const W = 1000;
  const H = 700;
  const sx = (v: number) => (clamp(v) / 100) * W;
  const sy = (v: number) => (clamp(v) / 100) * H;

  return (
    <svg className="plan" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Top-down plan of ${design.title}`}>
      <defs>
        <pattern id="p-lawn" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="var(--z-lawn)" />
          <path d="M3 12 l2 -5 M10 14 l1 -5" stroke="var(--z-lawn-mark)" strokeWidth="1.2" />
        </pattern>
        <pattern id="p-bed" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="var(--z-bed)" />
          <circle cx="4" cy="4" r="1.3" fill="var(--z-bed-mark)" />
          <circle cx="11" cy="10" r="1.3" fill="var(--z-bed-mark)" />
        </pattern>
        <pattern id="p-path" width="40" height="28" patternUnits="userSpaceOnUse">
          <rect width="40" height="28" fill="var(--z-path)" />
          <rect x="3" y="3" width="15" height="10" rx="3" fill="var(--z-path-mark)" />
          <rect x="22" y="15" width="15" height="10" rx="3" fill="var(--z-path-mark)" />
        </pattern>
        <pattern id="p-patio" width="30" height="30" patternUnits="userSpaceOnUse">
          <rect width="30" height="30" fill="var(--z-patio)" />
          <path d="M0 0 H30 V30" fill="none" stroke="var(--z-patio-mark)" strokeWidth="1.5" />
        </pattern>
        <pattern id="p-water" width="30" height="14" patternUnits="userSpaceOnUse">
          <rect width="30" height="14" fill="var(--z-water)" />
          <path d="M0 7 q7.5 -5 15 0 t15 0" fill="none" stroke="var(--z-water-mark)" strokeWidth="1.4" />
        </pattern>
        <pattern id="p-veg" width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill="var(--z-veg)" />
          <path d="M0 12 H24" stroke="var(--z-veg-mark)" strokeWidth="5" />
        </pattern>
        <pattern id="p-meadow" width="18" height="18" patternUnits="userSpaceOnUse">
          <rect width="18" height="18" fill="var(--z-meadow)" />
          <circle cx="4" cy="5" r="1.6" fill="#f2c14e" />
          <circle cx="13" cy="13" r="1.6" fill="#b39ddb" />
          <circle cx="13" cy="3" r="1.2" fill="#fff" />
        </pattern>
      </defs>

      <rect width={W} height={H} rx="18" fill="var(--plan-ground)" />

      {design.zones.map((z) => {
        const x = sx(z.x), y = sy(z.y);
        const w = Math.max(8, sx(z.x + z.w) - x), h = Math.max(8, sy(z.y + z.h) - y);
        const round = z.kind === "tree" || z.kind === "water" || z.kind === "container";
        const active = highlight === z.id;
        return (
          <g key={z.id} onMouseEnter={() => onHover?.(z.id)} onMouseLeave={() => onHover?.(null)} className="zone">
            {round ? (
              <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={ZONE_FILL[z.kind]}
                stroke={active ? "var(--accent)" : "var(--zone-stroke)"} strokeWidth={active ? 5 : 2} />
            ) : (
              <rect x={x} y={y} width={w} height={h} rx={z.kind === "path" ? 6 : 14} fill={ZONE_FILL[z.kind]}
                stroke={active ? "var(--accent)" : "var(--zone-stroke)"} strokeWidth={active ? 5 : 2} />
            )}
            {design.plants.filter((p) => p.zoneId === z.id).flatMap((p, pi) =>
              Array.from({ length: Math.min(p.quantity, 9) }, (_, i) => {
                const px = x + 10 + scatter(p.commonName, i) * Math.max(0, w - 20);
                const py = y + 10 + scatter(p.botanicalName + pi, i) * Math.max(0, h - 20);
                return <circle key={`${pi}-${i}`} cx={px} cy={py} r={p.role === "focal" || p.role === "structure" ? 9 : 6}
                  fill={ROLE_COLOR[p.role]} stroke="#fff" strokeWidth="1.5" opacity="0.92" />;
              }),
            )}
            {w > 90 && h > 34 && (
              <text x={x + w / 2} y={y + h / 2} className="zone-label" textAnchor="middle" dominantBaseline="middle">
                {z.name}
              </text>
            )}
          </g>
        );
      })}
      <text x={W - 20} y={H - 16} textAnchor="end" className="plan-compass">house / viewpoint ↓</text>
    </svg>
  );
}

export function PlanLegend() {
  return (
    <ul className="legend">
      {Object.entries(ROLE_COLOR).map(([role, color]) => (
        <li key={role}><span style={{ background: color }} />{role}</li>
      ))}
    </ul>
  );
}
