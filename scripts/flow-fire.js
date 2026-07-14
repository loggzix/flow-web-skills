// flow-fire.js — fire N canh video Flow lien tiep, KHONG cho render.
// Usage: node flow-fire.js <scenes.json> [reportPath]
// scenes.json: { "project": "<projectId>", "scenes": [{ "id": "canh1", "prompt": "..." }, ...] }
// Exit: 0 = tat ca da fire; 1 = loi; 2 = khong co page/CDP; 3 = config can chinh tay.
const fs = require('fs');
const lib = require('./flow-lib');

const [, , scenesPath, reportPath] = process.argv;
if (!scenesPath) { console.error('USAGE: node flow-fire.js <scenes.json> [report.json]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
const REPORT = reportPath || 'tools/last-fire-report.json';

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

    // Fire lien tiep; canh bi throttle (nut Tao mo qua lau) → gom lai, fire bu sau khi cho nha.
    const throttled = [];
    for (const scene of spec.scenes) {
      const res = await lib.fireScene(page, editor, scene.prompt, fired, 35000);
      report.scenes.push({ id: scene.id, fired: res.ok, seconds: res.seconds, firedAtMs: res.last ? res.last.at : null, endpoint: res.last ? res.last.url.split('?')[0] : null });
      console.log(res.ok ? `FIRED ${scene.id} in ${res.seconds}s` : `NOT_FIRED ${scene.id} after ${res.seconds}s${res.throttled ? ' (throttled)' : ''}`);
      if (!res.ok && res.throttled) throttled.push(scene);
    }

    // Fire bu cac canh throttled: cho ~30s cho server nha cap dong thoi, thu lai TUNG canh 1 lan.
    if (throttled.length) {
      console.log(`THROTTLED ${throttled.length} canh: ${throttled.map(s => s.id).join(', ')} — cho 30s roi fire bu.`);
      await page.waitForTimeout(30000);
      for (const scene of throttled) {
        const res = await lib.fireScene(page, editor, scene.prompt, fired, 25000);
        const rec = report.scenes.find(s => s.id === scene.id);
        if (res.ok) { rec.fired = true; rec.seconds = res.seconds; rec.firedAtMs = res.last ? res.last.at : null; rec.endpoint = res.last ? res.last.url.split('?')[0] : null; }
        console.log(res.ok ? `REFIRE_OK ${scene.id} in ${res.seconds}s` : `REFIRE_MISS ${scene.id} after ${res.seconds}s`);
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
    try { await page.screenshot({ path: 'tools/flow-fire-error.png' }); } catch (_) {}
    report.error = e.message.split('\n')[0];
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.error('ERR', report.error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
