// flow-config.js — set config video mac dinh cho project Flow dang mo.
// Usage: node flow-config.js <projectId> [model] [aspect] [count] [duration]
// Defaults: model="Lite [Lower Priority]" aspect="9:16" count="x2" duration="8"
const pw = require('playwright-core');
const lib = require('./flow-lib');

const [, , projectId, modelArg, aspectArg, countArg, durArg] = process.argv;
const MODEL = modelArg || 'Lower Priority';
const ASPECT = aspectArg || '9:16';
const COUNT = countArg || 'x2';
const DUR = (durArg || '8') + '';

(async () => {
  const browser = await pw.chromium.connectOverCDP(lib.CDP);
  const ctx = browser.contexts()[0];
  let page = projectId ? ctx.pages().find(p => p.url().includes(`/project/${projectId}`)) : null;
  if (!page) page = ctx.pages().find(p => p.url().includes('labs.google/fx'));
  if (!page) { console.log('NO_PAGE'); process.exit(2); }
  if (projectId && !page.url().includes(`/project/${projectId}`)) {
    await page.goto(`https://labs.google/fx/vi/tools/flow/project/${projectId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('[data-slate-editor]').first().waitFor({ timeout: 45000 });
    await page.waitForTimeout(1500);
  }

  const chipSel = 'button:has-text("crop_")';
  const chip = page.locator(chipSel).last();
  const chipText = async () => (await chip.textContent()) || '';
  console.log('CHIP_BEFORE:', await chipText());

  await chip.click({ timeout: 10000 });
  await page.waitForTimeout(800);

  const dumpMenu = async (label) => {
    if (!process.env.DEBUG) return;
    const info = await page.evaluate(() => {
      const out = { tabs: [], menuitems: [], dropdowns: [] };
      document.querySelectorAll('[role="tab"]').forEach(t => out.tabs.push({ t: t.textContent.trim().slice(0, 40), sel: t.getAttribute('aria-selected') }));
      document.querySelectorAll('[role="menuitem"],[role="option"]').forEach(m => out.menuitems.push(m.textContent.trim().slice(0, 60)));
      document.querySelectorAll('button').forEach(b => { const t = (b.textContent || '').trim(); if (t.includes('arrow_drop_down')) out.dropdowns.push(t.slice(0, 60)); });
      return out;
    });
    console.log(label, JSON.stringify(info, null, 1));
  };

  await dumpMenu('MENU_OPEN:');

  const videoTab = page.getByRole('tab', { name: /Video/ }).first();
  if (await videoTab.count()) {
    const sel = await videoTab.getAttribute('aria-selected');
    if (sel !== 'true') { await videoTab.click(); await page.waitForTimeout(800); console.log('SWITCHED_TO_VIDEO_TAB'); }
    else console.log('ALREADY_VIDEO_TAB');
  } else console.log('NO_VIDEO_TAB_FOUND');

  await dumpMenu('AFTER_VIDEO_TAB:');

  const dd = page.locator('button:has-text("arrow_drop_down")').last();
  if (await dd.count()) {
    const ddText = await dd.textContent();
    if (!ddText.includes(MODEL)) {
      await dd.click(); await page.waitForTimeout(600);
      const items = await page.locator('[role="menuitem"], [role="option"]').allTextContents();
      console.log('MODEL_OPTIONS:', JSON.stringify(items.map(s => s.trim().slice(0, 60))));
      const target = page.locator('[role="menuitem"], [role="option"]').filter({ hasText: MODEL }).first();
      if (await target.count()) { await target.click(); await page.waitForTimeout(600); console.log('MODEL_SET:', MODEL); }
      else { console.log('MODEL_NOT_FOUND:', MODEL); }
    } else console.log('MODEL_ALREADY:', ddText.trim().slice(0, 50));
  } else console.log('NO_MODEL_DROPDOWN');

  for (const [label, want] of [['aspect', ASPECT], ['count', COUNT], ['duration', DUR]]) {
    const wantRe = label === 'duration' ? new RegExp(`^${want}\\s*(s|giây)`) : null;
    const tabs = page.locator('[role="tab"]');
    const n = await tabs.count();
    let done = false;
    for (let i = 0; i < n; i++) {
      const t = (await tabs.nth(i).textContent() || '').trim();
      const match = wantRe ? wantRe.test(t.replace(/^[a-z_0-9]*crop[a-z_0-9]*/i, '').trim()) || t === want + ' giây' || t.endsWith(want + 's') || t === want
                           : t.includes(want);
      if (match) {
        const sel = await tabs.nth(i).getAttribute('aria-selected');
        if (sel !== 'true') { await tabs.nth(i).click(); await page.waitForTimeout(500); console.log(`${label.toUpperCase()}_SET:`, t); }
        else console.log(`${label.toUpperCase()}_ALREADY:`, t);
        done = true; break;
      }
    }
    if (!done) console.log(`${label.toUpperCase()}_TAB_NOT_FOUND (want ${want})`);
  }

  await dumpMenu('FINAL_STATE:');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  console.log('CHIP_AFTER:', await chipText());
  await browser.close();
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
