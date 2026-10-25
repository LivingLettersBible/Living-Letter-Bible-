# Living Letters Bible

> “Ye are our epistle written in our hearts, known and read of all men.” — 2 Corinthians 3:2

Write the whole Bible by hand, one verse at a time, with a finger, a stylus (Apple Pencil, S Pen, Surface Pen) or a mouse.

## Features

- **Write**: pick a book, chapter and verse, read it, then copy it onto ruled paper. Pen pressure changes the stroke width. You get five ink colours, an adjustable nib, an eraser (including the eraser end of a stylus), undo and redo, and you can add or remove lines.
- **Trace mode**: shows the verse faintly on the paper so you can write over it.
- **Amen, next verse**: marks the verse as written and moves to the next one, across chapter and book boundaries.
- **Progress**: tracks verses written overall, today, per book and per chapter (out of all 31,102 verses).
- **My Pages**: shows a chapter in your own handwriting, ready to print.
- **Stylus-only mode**: ignores finger and palm touches when you use a pen on a tablet.
- **Backup / restore**: handwriting is stored on the device (IndexedDB). You can download a JSON backup and restore it on another device.
- **Installable and works offline**: it is a PWA with a service worker. Everything is local and there are no accounts.

## Running it

It is a static site with no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

To install it on a phone or tablet, host the folder on any static host (for example GitHub Pages: Settings → Pages → deploy from `main`), open it, then choose **Add to Home Screen**. Offline mode needs `https` or `localhost`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Layout |
| `styles.css` | Parchment theme and print styles |
| `app.js` | Drawing, storage, navigation, progress, pages |
| `data/kjv.js` | Full King James Version text (public domain) |
| `sw.js`, `manifest.json`, `icon.svg` | Offline support and install metadata |

Strokes are stored as vectors normalised to the page width, so a written page redraws sharply at any screen size.
