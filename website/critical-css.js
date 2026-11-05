// Extract above-the-fold rules from theme main.css for the homepage
// -> jlmwines-theme/assets/css/critical-home.css (inlined on the front page
// by inc/enqueue.php; main.css then loads non-blocking). website/LCP_PLAN.md step 3.
//
// REGENERATE after any change to the homepage header/hero/shipping bar layout
// or the main.css rules they use, AFTER the main.css change is deployed (it
// reads the live page):
//   npm install --prefix <tmpdir> puppeteer-core@23
//   NODE_PATH=<tmpdir>/node_modules node website/critical-css.js website/jlmwines-theme/assets/css/critical-home.css
// Then deploy the theme again.
//
// Union across EN/HE x mobile/desktop viewports. Rules kept in source order.
// Elements with no box (hidden drawers, age gate, popups) count as above the
// fold so their hide rules are kept and nothing flashes visible.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES = ['https://jlmwines.com/', 'https://jlmwines.com/he/'];
const VIEWPORTS = [
  { width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true },
  { width: 1350, height: 940, deviceScaleFactor: 1 },
];
const OUT = process.argv[2];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const keep = new Set();
  let ruleTexts = null;
  for (const url of PAGES) for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.goto(url + '?crit=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    const res = await page.evaluate(() => {
      const sheet = [...document.styleSheets].find(s => s.href && s.href.includes('/jlmwines-theme/assets/css/main.css'));
      if (!sheet) return { error: 'main.css not found' };
      const H = window.innerHeight;
      const STRIP = /::?(hover|focus-visible|focus-within|focus|active|visited|before|after|placeholder|selection|marker|-webkit-[a-z-]+|-moz-[a-z-]+)(\([^)]*\))?/g;
      const aboveFold = el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return true; // hidden: keep its rules so it stays hidden
        return r.top < H;
      };
      const matches = sel => {
        let els;
        try { els = document.querySelectorAll(sel); }
        catch (e) { try { els = document.querySelectorAll(sel.replace(STRIP, '') || '*'); } catch (e2) { return true; } }
        if (!els.length) {
          const s2 = sel.replace(STRIP, '');
          if (s2 !== sel) { try { els = document.querySelectorAll(s2); } catch (e) { return true; } }
        }
        for (const el of els) if (aboveFold(el)) return true;
        return false;
      };
      const texts = [], kept = [];
      [...sheet.cssRules].forEach((rule, i) => {
        texts.push(rule.cssText);
        if (rule.type === 1) { if (matches(rule.selectorText)) kept.push([i]); }
        else if (rule.type === 4) { // @media
          const inner = [];
          [...rule.cssRules].forEach((r, j) => { if (r.type !== 1 || matches(r.selectorText)) inner.push(j); });
          if (inner.length) kept.push([i, inner]);
        }
        else kept.push([i]); // @font-face, @keyframes, @supports, etc.
      });
      return { texts, kept };
    });
    if (res.error) { console.log(url, res.error); process.exit(1); }
    ruleTexts = res.texts;
    res.kept.forEach(k => keep.add(JSON.stringify(k)));
    console.log(url, vp.width, 'kept', res.kept.length, 'of', res.texts.length);
    await page.close();
  }
  // Rebuild: top-level rules in order; @media merged across viewports.
  const top = new Map();
  for (const k of keep) { const [i, inner] = JSON.parse(k); if (!top.has(i)) top.set(i, new Set()); if (inner) inner.forEach(j => top.get(i).add(j)); }
  const page = await browser.newPage(); // reparse to rebuild @media with chosen inner rules
  await page.setContent('<style>' + '</style>');
  const css = await page.evaluate((texts, entries) => {
    const out = [];
    for (const [i, innerArr] of entries) {
      const t = texts[i];
      if (!t.startsWith('@media')) { out.push(t); continue; }
      const s = new CSSStyleSheet(); s.replaceSync(t);
      const m = s.cssRules[0];
      const inner = new Set(innerArr);
      out.push('@media ' + m.conditionText + ' {' + [...m.cssRules].filter((r, j) => inner.has(j)).map(r => r.cssText).join('') + '}');
    }
    return out.join('\n');
  }, ruleTexts, [...top.entries()].sort((a, b) => a[0] - b[0]).map(([i, s]) => [i, [...s]]));
  fs.writeFileSync(OUT, css);
  console.log('critical bytes', Buffer.byteLength(css), 'from', ruleTexts.join('').length);
  await browser.close();
})();
