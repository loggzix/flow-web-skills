// flow-fire-char.js — fire N canh video Flow che do Thanh phan, gan nhan vat (ingredient) truoc moi canh.
// Usage: node flow-fire-char.js <scenes.json> [reportPath]
// scenes.json: { project, character, expectConfig, promptTemplate ("<LINE>" placeholder), scenes: [{id, line}] }
// Exit: 0 = tat ca fired; 1 = loi; 2 = khong co page; 3 = config lech.
const fs = require('fs');
const lib = require('./flow-lib');

const [, , scenesPath, reportPath] = process.argv;
if (!scenesPath) { console.error('USAGE: node flow-fire-char.js <scenes.json> [report.json]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
const REPORT = reportPath || 'tools/last-fire-char-report.json';

async function ingredientCount(page) {
  return page.evaluate(() => {
    const ed = document.querySelector('[data-slate-editor]');
    if (!ed) return 0;
    let n = ed;
    for (let i = 0; i < 6 && n.parentElement; i++) n = n.parentElement;
    return [...n.querySelectorAll('img')].filter(im => (im.alt || '').includes('nhân vật')).length;
  });
}

async function clickAt(page, scope, needle) {
  const pt = await page.evaluate(([sc, n]) => {
    const root = sc === 'dialog' ? document.querySelector('[role="dialog"]') : document;
    if (!root) return null;
    const els = [...root.querySelectorAll('button, [role="button"], [role="tab"], [role="option"], div, span')];
    const cand = els.filter(e => {
      const t = (e.innerText || e.getAttribute('aria-label') || '').trim();
      return t === n || (t.includes(n) && t.length < n.length + 30);
    });
    const b = cand.sort((a, c) => (a.innerText || '').length - (c.innerText || '').length)[0];
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, [scope, needle]);
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  return true;
}

async function pollUntil(page, fn, timeoutMs, stepMs) {
  const deadline = Date.now() + timeoutMs;
  let v;
  while (Date.now() < deadline) {
    v = await fn();
    if (v) return v;
    await page.waitForTimeout(stepMs || 200);
  }
  return v;
}

async function attachIngredient(page, name) {
  if (!(await page.locator('[role="dialog"]').count())) {
    if (!(await clickAt(page, 'page', 'add_2'))) { console.log('NO_ADD_BTN'); return 0; }
    try { await page.locator('[role="dialog"]').waitFor({ timeout: 8000 }); } catch (_) { console.log('NO_DIALOG_AFTER_ADD'); return 0; }
  }

  await clickAt(page, 'dialog', 'Nhân vật');

  // Item co the chua render ngay sau khi doi tab — retry click theo dieu kien.
  const clicked = await pollUntil(page, () => clickAt(page, 'dialog', name), 8000);
  if (!clicked) {
    console.log('DIALOG_NO_ITEM');
    await page.keyboard.press('Escape');
    return 0;
  }

  // Click item DA add chip; chi bam "Thêm vào câu lệnh" khi chip chua xuat hien (tranh double ingredient).
  let chips = await pollUntil(page, () => ingredientCount(page), 4000, 150);
  if (!chips) {
    await clickAt(page, 'dialog', 'Thêm vào câu lệnh');
    chips = await pollUntil(page, () => ingredientCount(page), 4000, 150);
  }

  // Dialog khong tu dong khi bo qua nut them → Escape ngay, chi cho no bien mat.
  if (await page.locator('[role="dialog"]').count()) await page.keyboard.press('Escape');
  await pollUntil(page, async () => !(await page.locator('[role="dialog"]').count()), 3000, 150);
  return chips || 0;
}

(async () => {
  let { browser, ctx, page } = await lib.connect(spec.project);
  if (!page) { console.log('NO_PAGE'); process.exit(2); }

  const report = { project: spec.project, startedAt: new Date().toISOString(), config: null, scenes: [] };
  const fired = lib.trackFires(ctx);
  const born = lib.trackBirths(ctx, spec.project);

  try {
    const got = await lib.gotoProject(page, spec.project, ctx);
    page = got.page;
    const editor = got.editor;

    const cfg = await lib.checkConfig(page, spec.expectConfig, spec.project);
    report.config = cfg.barText;
    if (!cfg.ok) { fs.writeFileSync(REPORT, JSON.stringify(report, null, 2)); process.exit(3); }

    const throttled = [];
    for (const scene of spec.scenes) {
      const tA = Date.now();
      let ing = await ingredientCount(page);
      if (!ing) {
        ing = await attachIngredient(page, spec.character);
        const dA = ((Date.now() - tA) / 1000).toFixed(1);
        console.log(ing ? `INGREDIENT_ATTACHED ${scene.id} chips=${ing} in ${dA}s` : `INGREDIENT_FAIL ${scene.id}`);
        if (!ing) { report.scenes.push({ id: scene.id, fired: false, error: 'ingredient' }); continue; }
      }

      const prompt = spec.promptTemplate.replace('<LINE>', scene.line);
      const res = await lib.fireScene(page, editor, prompt, fired, 30000);
      const total = +(((Date.now() - tA) / 1000).toFixed(1));
      report.scenes.push({ id: scene.id, fired: res.ok, seconds: total, firedAtMs: res.last ? res.last.at : null, entities: res.last ? res.last.entities : null, endpoint: res.last ? res.last.url.split('?')[0] : null });
      console.log(res.ok ? `FIRED ${scene.id} in ${total}s entities=${res.last.entities} via ${res.last.url.split('?')[0]}` : `NOT_FIRED ${scene.id} after ${total}s${res.throttled ? ' (throttled)' : ''}`);
      if (!res.ok && res.throttled) throttled.push(scene);
    }

    // Fire bu canh throttled: cho 30s nha cap dong thoi, gan lai ingredient + fire lai tung canh.
    if (throttled.length) {
      console.log(`THROTTLED ${throttled.length} canh: ${throttled.map(s => s.id).join(', ')} — cho 30s roi fire bu.`);
      await page.waitForTimeout(30000);
      for (const scene of throttled) {
        if (!(await ingredientCount(page))) await attachIngredient(page, spec.character);
        const prompt = spec.promptTemplate.replace('<LINE>', scene.line);
        const res = await lib.fireScene(page, editor, prompt, fired, 30000);
        const rec = report.scenes.find(s => s.id === scene.id);
        if (res.ok) { rec.fired = true; rec.firedAtMs = res.last ? res.last.at : null; rec.entities = res.last ? res.last.entities : null; rec.endpoint = res.last ? res.last.url.split('?')[0] : null; }
        console.log(res.ok ? `REFIRE_OK ${scene.id}` : `REFIRE_MISS ${scene.id} after ${res.seconds}s`);
      }
    }

    const mult = parseInt(((report.config || '').match(/x(\d+)/) || [])[1], 10) || 4;
    await lib.waitBirths(page, born, report.scenes.filter(s => s.fired).length * mult);
    const asg = lib.assignBirths(born, report.scenes, s => spec.promptTemplate.replace('<LINE>', spec.scenes.find(x => x.id === s.id).line));
    for (const s of report.scenes) s.workflowIds = asg.bySceneId[s.id] || [];
    if (asg.unmatched.length) report.unmatchedWorkflows = asg.unmatched;
    report.totalFired = fired.length;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    const okAll = report.scenes.every(s => s.fired);
    console.log(`DONE fired=${report.scenes.filter(s => s.fired).length}/${spec.scenes.length} report=${REPORT}`);
    process.exit(okAll ? 0 : 1);
  } catch (e) {
    try { await page.screenshot({ path: 'tools/flow-fire-char-error.png' }); } catch (_) {}
    report.error = e.message.split('\n')[0];
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.error('ERR', report.error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
