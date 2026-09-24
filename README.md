# Living Colors — Color by Number

A relaxing color-by-number web app, similar to *Coloring Book – Color by Number* on the App Store.
Pick a numbered color, tap (or drag across) the matching cells, and watch the picture come to life.

It's a plain static site: no build step, no dependencies, no server code.

## Features

- **Line-art gardens:** Mushroom Garden, Wisteria Path, Garden Tea Party, Poppy Garden and Lantern Arbor
  (original drawings made by `tools/gardens.py`)
- **Line-art hearts:** detailed coloring-book pages (Songbird, Harvest, Mountain, Ocean and Lace hearts).
  Tap a numbered area to fill it, drag to move around, and pinch to zoom in on small areas
- **12 pixel-style pictures** in categories: Faith (Sunrise Cross, Dove of Peace, Noah's Rainbow,
  Ichthys Fish, Star of Bethlehem), Nature, Animals and Love
- **Picture of the day** on the home screen
- **Tap or drag to paint.** Cells of the selected color are highlighted, and numbers appear once you zoom in
- **Zoom and pan:** pinch or two-finger drag on touch screens; scroll-wheel or trackpad pinch, and hold
  <kbd>Space</kbd> (or use the move button) to drag on desktop
- **Hint button** jumps to a cell you still need to paint
- **Progress ring** on every color, which automatically moves to the next color when one is finished
- **Completion celebration** with confetti, a time-lapse replay, and PNG download
- **Color your own photo:** turns any image into a color-by-number page (choose detail and number of colors).
  Photos never leave the device
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

Garden pages are drawn in code: `tools/gardens.py` writes SVGs to `art/gardens/`, each shape filled with
its final color. `node tools/render_svg.js` renders the outlines and the color plan, and the build script
takes each area's color from the plan.

## Add pixel pictures

Pixel pictures live in [`js/pictures.js`](js/pictures.js) and are drawn with a small shape API
(`rect`, `circle`, `ellipse`, `poly`, `line`, `ring`, `where`, `px`) on a grid:

```js
art('my-id', 'My Picture', 'Nature', 32,
  ['#bde6ff', '#ffd54f', '#3f9b4b'],   // palette: color 1, 2, 3…
  (d) => {
    d.fill(0);                          // sky
    d.circle(16, 12, 6, 1);             // sun
    d.rect(0, 24, 32, 8, 2);            // grass
  }),
```

## Files

| Path | What it is |
| --- | --- |
| `index.html` | App shell (gallery, editor, dialogs) |
| `css/style.css` | Styles, including dark mode |
| `js/pictures.js` | Built-in pixel pictures |
| `js/lineart.js` | Line-art pages (generated, don't edit by hand) |
| `art/hearts/`, `art/gardens/` | Source line art (gardens also have SVG sources and color plans) |
| `tools/build_line_art.py` | Turns line art into numbered, colorable areas |
| `tools/gardens.py`, `tools/render_svg.js` | Draw and render the garden pages |
| `js/app.js` | Gallery, painting canvas, zoom/pan, saving, photo import |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and installable-app metadata |
