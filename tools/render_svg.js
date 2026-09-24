// Render the SVG line art with headless Chromium.
// art/drawn/*.svg is rendered twice:
//   <name>.png       black outlines on white (the coloring page)
//   <name>-plan.png  fills only, no outlines (the colour plan)
// art/vintage/*.svg is rasterized once, centred on a white 1000px square.
// Usage: node tools/render_svg.js   (needs playwright or playwright-core)
const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}

const dir = path.join(__dirname, '..', 'art', 'drawn');
const vintage = path.join(__dirname, '..', 'art', 'vintage');
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
  for (const file of fs.readdirSync(vintage).filter((f) => f.endsWith('.svg'))) {
    const data = fs.readFileSync(path.join(vintage, file)).toString('base64');
    await page.setContent(`<style>html,body{margin:0;background:#fff}img{display:block;width:960px;height:960px;margin:20px;object-fit:contain}</style><img src="data:image/svg+xml;base64,${data}">`);
    await page.locator('img').evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(vintage, file.replace('.svg', '.png')) });
    console.log('rendered', file);
  }
  await browser.close();
})();
