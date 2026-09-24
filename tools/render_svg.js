// Render each art/gardens/*.svg twice with headless Chromium:
//   <name>.png       black outlines on white (the coloring page)
//   <name>-plan.png  fills only, no outlines (the colour plan)
// Usage: node tools/render_svg.js   (needs playwright or playwright-core)
const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}

const dir = path.join(__dirname, '..', 'art', 'gardens');
const LINES = '[fill]:not([fill="none"]) { fill: #ffffff !important; }';
const PLAN = '* { stroke: none !important; }';

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, deviceScaleFactor: 1 });
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const [suffix, css] of [['', LINES], ['-plan', PLAN]]) {
      await page.setContent(`<style>html,body{margin:0}${css}</style>${svg}`);
      await page.locator('svg').screenshot({ path: path.join(dir, file.replace('.svg', suffix + '.png')) });
    }
    console.log('rendered', file);
  }
  await browser.close();
})();
