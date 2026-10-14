import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GardenDesignSchema, type DesignRequest, type GardenDesign } from "./schema.ts";

const MODEL = process.env.GARDENER_MODEL ?? "claude-opus-5-5";
const PORT = Number(process.env.PORT ?? 8787);
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const client = new Anthropic();
// The SDK can also authenticate from an `ant auth login` profile, so this is only a hint.
const hasEnvKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(express.json({ limit: "1mb" }));

const DESIGNER_SYSTEM = `You are Wannabe Gardener, a warm, practical landscape designer for people who have never gardened before.

Given a photo (or description) of an outdoor or indoor space plus the owner's preferences, produce a complete, buildable redesign in the requested style.

Guidelines:
- Ground the site analysis in what is actually visible in the photo. If no photo is given, reason from the description and say what you're assuming.
- Pick plants that genuinely suit the stated climate, sun and maintenance level. Prefer forgiving, widely available nursery plants for beginners; favour natives where they fit the style.
- Never suggest invasive species for the stated region, and flag anything toxic to pets in its beginnerTip.
- Lay zones out on a 0-100 x 0-100 top-down plan of the space. Keep them inside the plan, sized realistically, with paths connecting areas people need to reach.
- Every plant's zoneId must match a zone id.
- Keep costs realistic for US garden centres and make budget.totalUSD equal plants + materials and land near the owner's budget.
- Steps should be achievable by a novice on weekends, in order.
- Write like a friendly expert: specific, encouraging, no filler.`;

app.post("/api/design", upload.single("photo"), async (req, res) => {
  const prefs = (req.body ?? {}) as Partial<DesignRequest>;
  const file = req.file;

  if (file && !IMAGE_TYPES.includes(file.mimetype as ImageType)) {
    res.status(400).json({ error: "Please upload a JPEG, PNG, GIF or WebP photo." });
    return;
  }
  if (!file && !prefs.notes?.trim()) {
    res.status(400).json({ error: "Add a photo of your space, or describe it in the notes." });
    return;
  }

  const brief = [
    `Space type: ${prefs.space || "backyard"}`,
    `Style: ${prefs.style || "cottage garden"}`,
    `Sun exposure: ${prefs.sun || "not sure - estimate from the photo"}`,
    `Maintenance appetite: ${prefs.maintenance || "low"}`,
    `Budget: ${prefs.budget || "around $500"}`,
    `Climate / region: ${prefs.climate || "not given - choose broadly adaptable plants"}`,
    prefs.notes?.trim() ? `Owner's notes: ${prefs.notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (file) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: file.mimetype as ImageType, data: file.buffer.toString("base64") },
    });
  }
  content.push({
    type: "text",
    text: `${file ? "Here is a photo of my space." : "I don't have a photo; here is my space."}\n\n${brief}\n\nDesign my garden.`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(GardenDesignSchema) },
      system: DESIGNER_SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "The designer couldn't work with that request. Try a different photo or description." });
      return;
    }
    if (!response.parsed_output) {
      res.status(502).json({ error: "The design came back incomplete. Please try again." });
      return;
    }
    res.json({ design: response.parsed_output });
  } catch (err) {
    sendApiError(res, err);
  }
});

interface AskBody {
  design: GardenDesign;
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
}

app.post("/api/ask", async (req, res) => {
  const { design, history = [], question } = (req.body ?? {}) as Partial<AskBody>;
  if (!design || !question?.trim()) {
    res.status(400).json({ error: "A design and a question are required." });
    return;
  }

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: `You are Wannabe Gardener, a friendly garden coach. The user is building the garden design below. Answer their questions about it in plain language, in a few short paragraphs or a short list. Be specific to their plants and layout.\n\n<design>\n${JSON.stringify(design)}\n</design>`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [...history.slice(-12), { role: "user", content: question.trim() }],
    });

    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "I can't help with that one. Try asking another way." });
      return;
    }
    const answer = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    res.json({ answer });
  } catch (err) {
    sendApiError(res, err);
  }
});

function sendApiError(res: express.Response, err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) {
    res.status(500).json({ error: "The server's Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY and restart." });
  } else if (err instanceof Anthropic.RateLimitError) {
    res.status(429).json({ error: "Too many requests right now. Give it a minute and try again." });
  } else if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    res.status(502).json({ error: "The AI designer is having trouble. Please try again." });
  } else {
    console.error(err);
    res.status(500).json({
      error: hasEnvKey ? "Something went wrong on our side." : "The server has no Anthropic API key. Add ANTHROPIC_API_KEY to wannabe-gardener/.env and restart.",
    });
  }
}

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Wannabe Gardener API on http://localhost:${PORT}`);
  if (!hasEnvKey) console.warn("ANTHROPIC_API_KEY is not set - copy .env.example to .env and add your key.");
});
