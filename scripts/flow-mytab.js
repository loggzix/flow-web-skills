const pw = require('playwright-core');
const fs = require('fs');

const CHAR_URL = process.env.FLOW_CHAR_URL || 'https://labs.google/fx/vi/tools/flow/project/4660f586-d329-48dc-8a1a-3e44234fe0d1/character/1a311aaa-87cc-4d2c-92b8-11aaadb27454';
const MARK = CHAR_URL.includes('/character/') ? 'character/' + CHAR_URL.split('/character/')[1].slice(0, 8) : 'character/';

async function getPage(ctx) {
  let page = ctx.pages().find(p => p.url().includes(MARK));
  if (!page) {
    page = await ctx.newPage();
    await page.goto(CHAR_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
  }
  return page;
}

async function dump(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('button, [role="button"], [role="option"], [role="menuitem"], textarea, input')];
    return els.map(b => {
      const r = b.getBoundingClientRect();
      const t = (b.innerText || b.getAttribute('aria-label') || b.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 70);
      return { tag: b.tagName, t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(b => b.w > 0 && b.h > 0 && b.t);
  });
}

const lib = require('./flow-lib');

async function clickByText(page, name) {
  return lib.clickByLocator(page, 'page', name);
}

module.exports = { getPage, dump, clickByText, CHAR_URL };

if (require.main === module) {
  const [, , action, arg1, arg2] = process.argv;
  (async () => {
    const browser = await pw.chromium.connectOverCDP(lib.CDP);
    const ctx = browser.contexts()[0];
    const page = await getPage(ctx);
    console.log('PAGE', page.url());

    if (action === 'dump') {
      console.log(JSON.stringify(await dump(page), null, 1));
      await page.screenshot({ path: 'tools/flow-state.png' });
    } else if (action === 'click') {
      const ok = await clickByText(page, arg1);
      console.log(ok ? 'CLICKED ' + arg1 : 'BTN_NOT_FOUND ' + arg1);
      if (!ok) process.exit(1);
      await page.waitForTimeout(2500);
      console.log(JSON.stringify(await dump(page), null, 1));
      await page.screenshot({ path: 'tools/flow-state.png' });
    } else if (action === 'capture') {
      let saved = false;
      ctx.on('response', async (r) => {
        if (saved) return;
        const ct = (r.headers()['content-type'] || '');
        if (r.url().includes('flow-content.google/audio') || ct.startsWith('audio/')) {
          try {
            const body = await r.body();
            if (body.length < 2000) return;
            fs.writeFileSync(arg2, body);
            saved = true;
            console.log('SAVED', arg2, body.length, 'bytes');
          } catch (e) { console.log('BODY_ERR', e.message.split('\n')[0]); }
        }
      });
      const ok = await clickByText(page, arg1);
      console.log(ok ? 'CLICKED ' + arg1 : 'BTN_NOT_FOUND ' + arg1);
      if (!ok) process.exit(1);
      const deadline = Date.now() + 60000;
      while (!saved && Date.now() < deadline) await page.waitForTimeout(500);
      if (!saved) {
        await page.screenshot({ path: 'tools/flow-error.png' });
        console.log('TIMEOUT_NO_AUDIO');
        process.exit(1);
      }
    } else if (action === 'shot') {
      await page.screenshot({ path: arg1 || 'tools/flow-state.png' });
      console.log('SHOT_OK');
    }
    await browser.close();
  })();
}
