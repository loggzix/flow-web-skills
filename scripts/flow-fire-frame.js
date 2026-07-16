// flow-fire-frame.js — fire N cảnh video Flow chế độ Khung hình (frame đầu/cuối).
// Usage: node flow-fire-frame.js <scenes.json> [reportPath]
// scenes.json: { project, expectConfig, scenes: [{id, prompt, frame}] }
//   frame = tên file ảnh đã upload vào project (alt trong dialog = TÊN FILE)
// Exit: 0 = tất cả fired; 1 = lỗi; 2 = không có page; 3 = config lệch.
const fs = require('fs');
const lib = require('./flow-lib');

const [, , scenesPath, reportPath] = process.argv;
if (!scenesPath) { console.error('USAGE: node flow-fire-frame.js <scenes.json> [report.json]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(scenesPath, 'utf8').replace(/^\uFEFF/, ''));
const REPORT = reportPath || 'last-fire-frame-report.json';

// Check slot Bắt đầu đã có thumbnail (= frame attached)
async function hasStartFrame(page) {
  return page.evaluate(() => {
    const slots = document.querySelectorAll('[data-slate-editor]');
    if (!slots.length) return false;
    let ed = slots[0];
    for (let i = 0; i < 8 && ed.parentElement; i++) ed = ed.parentElement;
    // Tìm thumbnail trong vùng slot — ảnh nhỏ thay cho label "Bắt đầu"
    const imgs = [...ed.querySelectorAll('img')].filter(im => !im.alt.includes('nhân vật'));
    return imgs.length > 0;
  });
}

// Attach frame Bắt đầu bằng cách click slot → dialog → chọn ảnh theo tên file
async function attachFrame(page, frameName) {
  // Click slot Bắt đầu
  const slotClicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, div')].find(e =>
      (e.innerText || '').trim() === 'Bắt đầu' || (e.getAttribute('aria-label') || '').includes('Bắt đầu'));
    if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
    return false;
  });
  if (!slotClicked) { console.log('NO_START_SLOT'); return false; }

  try { await page.locator('[role="dialog"]').waitFor({ timeout: 8000 }); } catch (_) { console.log('NO_DIALOG_AFTER_SLOT'); return false; }

  // Click tab Hình ảnh
  const tabClicked = await lib.pollUntil(page, () => page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const tabs = [...dlg.querySelectorAll('[role="tab"]')];
    const imgTab = tabs.find(t => (t.innerText || '').includes('Hình ảnh'));
    if (imgTab) { imgTab.click(); return true; }
    return false;
  }), 5000);
  if (!tabClicked) console.log('WARN: no Hình ảnh tab, trying current tab');

  // Tìm item theo alt = tên file
  const itemFound = await lib.pollUntil(page, () => page.evaluate((name) => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const img = dlg.querySelector(`img[alt="${name}"]`) || dlg.querySelector(`img[alt*="${name}"]`);
    if (img) { img.scrollIntoView({ block: 'center' }); img.click(); return true; }
    return false;
  }, frameName), 8000);

  if (!itemFound) {
    // Try search box
    const searchBox = await page.locator('[role="dialog"] input[placeholder*="Tìm"]');
    if (await searchBox.count()) {
      await searchBox.fill(frameName);
      const found = await lib.pollUntil(page, () => page.evaluate((name) => {
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return false;
        const img = dlg.querySelector(`img[alt="${name}"]`) || dlg.querySelector(`img[alt*="${name}"]`);
        if (img) { img.scrollIntoView({ block: 'center' }); img.click(); return true; }
        return false;
      }, frameName), 6000);
      if (!found) { console.log('DIALOG_NO_ITEM ' + frameName); await page.keyboard.press('Escape'); return false; }
    } else {
      console.log('DIALOG_NO_ITEM ' + frameName);
      await page.keyboard.press('Escape');
      return false;
    }
  }

  // Bấm "Thêm vào câu lệnh" nếu cần
  await page.waitForTimeout(500);
  const addBtn = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const btn = [...dlg.querySelectorAll('button')].find(b => (b.innerText || '').includes('Thêm vào câu lệnh'));
    if (btn) { btn.click(); return true; }
    return false;
  });

  // Đóng dialog
  if (await page.locator('[role="dialog"]').count()) await page.keyboard.press('Escape');
  await lib.pollUntil(page, async () => !(await page.locator('[role="dialog"]').count()), 3000, 150);

  // Verify slot có thumbnail
  const attached = await lib.pollUntil(page, () => hasStartFrame(page), 4000, 200);
  return !!attached;
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
    if (!cfg.ok) {
      console.log(`CONFIG_MISMATCH — chip: ${cfg.barText} | expected: ${spec.expectConfig.join(', ')}`);
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
      process.exit(3);
    }

    const throttled = [];
    for (const scene of spec.scenes) {
      const tA = Date.now();

      // Frame bị CLEAR sau mỗi Tạo → gắn lại trước từng cảnh
      if (scene.frame) {
        const ok = await attachFrame(page, scene.frame);
        const dA = ((Date.now() - tA) / 1000).toFixed(1);
        console.log(ok ? `FRAME_ATTACHED ${scene.id} file=${scene.frame} in ${dA}s` : `FRAME_FAIL ${scene.id} file=${scene.frame}`);
        if (!ok) { report.scenes.push({ id: scene.id, fired: false, error: 'frame_attach' }); continue; }
      }

      const res = await lib.fireScene(page, editor, scene.prompt, fired, 30000);
      const total = +(((Date.now() - tA) / 1000).toFixed(1));
      report.scenes.push({
        id: scene.id, fired: res.ok, seconds: total,
        firedAtMs: res.last ? res.last.at : null,
        entities: res.last ? res.last.entities : null,
        endpoint: res.last ? res.last.url.split('?')[0] : null
      });
      console.log(res.ok
        ? `FIRED ${scene.id} in ${total}s endpoint=${(res.last ? res.last.url.split('?')[0] : '?').split('/').pop()}`
        : `NOT_FIRED ${scene.id} after ${total}s${res.throttled ? ' (throttled)' : ''}`);
      if (!res.ok && res.throttled) throttled.push(scene);
    }

    // Fire bù cảnh throttled
    if (throttled.length) {
      console.log(`THROTTLED ${throttled.length} canh — cho 30s roi fire bu.`);
      await page.waitForTimeout(30000);
      for (const scene of throttled) {
        if (scene.frame) await attachFrame(page, scene.frame);
        const res = await lib.fireScene(page, editor, scene.prompt, fired, 30000);
        const rec = report.scenes.find(s => s.id === scene.id);
        if (res.ok) { rec.fired = true; rec.firedAtMs = res.last ? res.last.at : null; rec.entities = res.last ? res.last.entities : null; rec.endpoint = res.last ? res.last.url.split('?')[0] : null; }
        console.log(res.ok ? `REFIRE_OK ${scene.id}` : `REFIRE_MISS ${scene.id}`);
      }
    }

    const mult = parseInt(((report.config || '').match(/x(\d+)/) || [])[1], 10) || 4;
    await lib.waitBirths(page, born, report.scenes.filter(s => s.fired).length * mult);
    const asg = lib.assignBirths(born, report.scenes, s => spec.scenes.find(x => x.id === s.id).prompt);
    for (const s of report.scenes) s.workflowIds = asg.bySceneId[s.id] || [];
    if (asg.unmatched.length) report.unmatchedWorkflows = asg.unmatched;
    report.totalFired = fired.length;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    const okAll = report.scenes.every(s => s.fired);
    console.log(`DONE fired=${report.scenes.filter(s => s.fired).length}/${spec.scenes.length} report=${REPORT}`);
    process.exit(okAll ? 0 : 1);
  } catch (e) {
    try { await page.screenshot({ path: 'flow-fire-frame-error.png' }); } catch (_) {}
    report.error = e.message.split('\n')[0];
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.error('ERR', report.error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
