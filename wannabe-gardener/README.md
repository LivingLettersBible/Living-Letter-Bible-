# 🌿 Wannabe Gardener

An AI garden designer, in the spirit of AI home-decor apps. Upload a photo of your backyard, balcony or patio, pick a style, and get a complete beginner-friendly redesign:

- **Before / after slider**: your photo next to a generated top-down garden plan
- **Layout plan**: zones (beds, lawn, paths, patio, water, trees, veg beds) with plants drawn in
- **Plant cards**: common and botanical name, placement, sun, water, size, cost, why it works, a beginner tip (including pet-toxicity warnings)
- **Shopping list and budget**: a checklist of plants and materials with totals
- **Build steps**: what to do each weekend
- **Care calendar**: tasks for each season
- **Ask the gardener**: chat about your design ("what should I buy first?")
- **Saved designs**: your past designs, stored in your browser

10 styles: Cottage, Japanese Zen, Modern, Mediterranean, Tropical, Desert Xeriscape, Wildflower Meadow, Kitchen Garden, Woodland Shade, Boho Jungle.

## How it works

The React frontend (Vite) sends the photo and your preferences to a small Express server. The server calls Claude (`claude-opus-5-5`) with vision and **structured outputs**: the response must match the Zod schema in `server/schema.ts`, so the UI always gets well-formed data to render. Server-side refusal fallback is turned on. Your API key stays on the server.

## Run it

```bash
cd wannabe-gardener
npm install
cp .env.example .env      # then put your Anthropic API key in .env
npm run dev               # web on http://localhost:5173, API on :8787
```

Production: `npm run build && npm start` (serves the built app and the API on `PORT`, default 8787).

Set `GARDENER_MODEL` in `.env` to use a different Claude model.
