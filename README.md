# Living Colors — Color by Number

A relaxing color-by-number web app, similar to *Coloring Book – Color by Number* on the App Store.
Pick a numbered color, tap (or drag across) the matching cells, and watch the picture come to life.

It's a plain static site: no build step, no dependencies, no server code.

## Features

- **12 built-in pictures** in categories: Faith (Sunrise Cross, Dove of Peace, Noah's Rainbow,
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

## Add your own pictures

Pictures live in [`js/pictures.js`](js/pictures.js) and are drawn with a small shape API
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
| `js/pictures.js` | Built-in coloring pages |
| `js/app.js` | Gallery, painting canvas, zoom/pan, saving, photo import |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and installable-app metadata |
