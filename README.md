# Living Colors — Color by Number

A relaxing color-by-number web app, similar to *Coloring Book – Color by Number* on the App Store.
Pick a numbered color, tap the matching areas of a line drawing, and watch the picture come to life.

It's a plain static site: no build step, no dependencies, no server code.

## Features

- **18 line-art pages** in four categories:
  - **Gardens:** Mushroom Garden, Wisteria Path, Garden Tea Party, Poppy Garden, Lantern Arbor
  - **Hearts:** Songbird, Harvest, Mountain, Ocean and Lace hearts
  - **Faith:** Sunrise Cross, Dove of Peace, Noah's Ark, Loaves and Fishes, Star of Bethlehem
  - **Animals:** Little Lamb, Ginger Kitty, Butterfly

  Gardens, Faith and Animals are original drawings made by `tools/draw_pages.py`.
- **Picture of the day** on the home screen
- **Tap to paint.** Areas of the selected color are highlighted, and numbers appear as you zoom in
- **Zoom and pan:** drag to move, pinch to zoom; scroll-wheel or trackpad pinch on desktop
- **Hint button** jumps to an area you still need to paint
- **Progress ring** on every color, which automatically moves to the next color when one is finished
- **Completion celebration** with confetti, a time-lapse replay, and PNG download
- **Progress saves automatically** in the browser
- **Installable app (PWA)** that works offline after the first visit, with light and dark mode

Keyboard: `H` hint · `+`/`-` zoom · `0` fit · `←`/`→` change color · `Esc` back to gallery.

## Run it locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish it

Upload the folder to any static host: GitHub Pages (Settings → Pages → deploy from this branch),
Netlify, Vercel or Cloudflare Pages. On a phone, open the site and choose **Add to Home Screen**
to install it like an app.

## Add line-art pages

1. Save a clean black-and-white line drawing as a PNG in `art/hearts/` (roughly square, closed outlines).
2. Add it to the `PICS` list in [`tools/build_line_art.py`](tools/build_line_art.py) with a title and a color
   plan: a function that sorts each area into a group (by position and size) and a list of shades per group.
3. Rebuild the data:

```sh
pip install pillow numpy scipy
PREVIEW_DIR=/tmp python3 tools/build_line_art.py   # also writes finished-color previews to /tmp
```

This regenerates `js/lineart.js`.

Garden, Faith and Animal pages are drawn in code: `tools/draw_pages.py` writes SVGs to `art/drawn/`, each shape filled with
its final color. `node tools/render_svg.js` renders the outlines and the color plan, and the build script
takes each area's color from the plan.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | App shell (gallery, editor, dialogs) |
| `css/style.css` | Styles, including dark mode |
| `js/lineart.js` | Line-art pages (generated, don't edit by hand) |
| `art/hearts/`, `art/drawn/` | Source line art (drawn pages also have SVG sources and color plans) |
| `tools/build_line_art.py` | Turns line art into numbered, colorable areas |
| `tools/draw_pages.py`, `tools/render_svg.js` | Draw and render the original pages |
| `js/app.js` | Gallery, painting canvas, zoom/pan, saving, photo import |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and installable-app metadata |
