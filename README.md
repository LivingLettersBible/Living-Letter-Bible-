# Living Letters

A website for **Living Letters** — a home for reading Scripture together through
simple, honest reading rhythms. Named after 2 Corinthians 3:2–3 ("You yourselves
are our letter... written not with ink but with the Spirit of the living God,
not on tablets of stone but on tablets of human hearts").

Built as a static site inspired by the concept of sites like rhythmandbible.com:
Bible reading plans, devotionals, and resources for daily Scripture reading.

## Structure

```
index.html              Home page
about.html               Mission, story, and values
reading-plans.html        4 reading plans with expandable day-by-day outlines
devotionals.html          Devotional post index
posts/                    Individual devotional posts
resources.html            Translation guide, journaling prompts, downloads (placeholder)
contact.html              Contact form + newsletter signup
css/style.css             Shared styles (all pages)
js/main.js                Shared behavior: mobile nav, accordions, demo form handling
```

## Running locally

No build step required — it's plain HTML/CSS/JS. Either:

- Open `index.html` directly in a browser, or
- Serve the folder locally, e.g. `python3 -m http.server`, then visit `http://localhost:8000`

## Deploying

This is static output, so it can be hosted as-is on GitHub Pages, Netlify,
Vercel, Cloudflare Pages, or any static file host.

## Before launch — things to wire up

- **Forms**: The contact form and newsletter signups (`data-demo-form` in
  `js/main.js`) currently just show an inline "thanks" message with no backend.
  Wire them to a real service (Formspree, Netlify Forms, Mailchimp, ConvertKit, etc.)
  before relying on them.
- **Contact email**: Replace the placeholder `hello@livingletters.example` address
  in `contact.html` with a real inbox.
- **Branding**: Colors, type (Fraunces + Inter via Google Fonts), and copy are all
  original — feel free to swap in real branding, a logo, and photography.
- **Resources**: The "Reading Plan Trackers" and "Memory Verse Cards" resource
  cards are marked "Coming soon" — add real downloadable files when ready.
