// flow-job-mixed.js — fire mixed-mode job (frame + char scenes in same project).
// Usage: node flow-job-mixed.js <mixed-scenes.json> <outDir>
// mixed-scenes.json: {
//   project, expectConfig,
//   frameScenes: [{id, prompt, frame}],  // chế độ Khung hình
//   charScenes: [{id, line}],            // chế độ Thành phần
//   character: "tên nhân vật",           // for charScenes
//   promptTemplate: "...<LINE>..."       // for charScenes
// }
// Flow: config Khung hình → fire frameScenes → fire charScenes → poll → download all.
// Exit: 0 = OK; 1 = partial/error; 2 = no page; 3 = config mismatch.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , mixedPath, outDir] = process.argv;
if (!mixedPath || !outDir) { console.error('USAGE: node flow-job-mixed.js <mixed-scenes.json> <outDir>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(mixedPath, 'utf8').replace(/^\uFEFF/, ''));
fs.mkdirSync(outDir, { recursive: true });

const oldMp4 = fs.readdirSync(outDir).filter(f => f.endsWith('.mp4'));
if (oldMp4.length) { console.log(`JOB_ABORT: outDir đã có ${oldMp4.length} .mp4 — dùng thư mục MỚI.`); process.exit(1); }

function run(script, args) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, script), ...args], { timeout: 10 * 60 * 1000 });
    let out = '';
    child.stdout.on('data', d => { out += d; process.stdout.write(d); });
    child.stderr.on('data', d => { out += d; process.stderr.write(d); });
    child.on('close', code => resolve({ code, out }));
    child.on('error', e => resolve({ code: 1, out: e.message }));
  });
}

(async () => {
  let totalFired = 0;
  const reports = [];

  // --- Phase 1: Frame scenes (Khung hình) ---
  if (spec.frameScenes && spec.frameScenes.length) {
    console.log(`\n=== PHASE 1: KHUNG HÌNH — ${spec.frameScenes.length} cảnh ===`);
    const frameSpec = {
      project: spec.project,
      expectConfig: spec.expectConfig,
      scenes: spec.frameScenes
    };
    const frameSpecPath = path.join(outDir, '_frame-scenes.json');
    const frameReport = path.join(outDir, 'fire-frame-report.json');
    fs.writeFileSync(frameSpecPath, JSON.stringify(frameSpec, null, 2));

    // Config for Khung hình mode
    const cfg = await run('flow-config.js', [spec.project]);
    if (cfg.code === 3) { console.log('CONFIG_FAIL frame mode'); process.exit(3); }

    await run('flow-fire-frame.js', [frameSpecPath, frameReport]);
    try {
      const r = JSON.parse(fs.readFileSync(frameReport, 'utf8'));
      totalFired += (r.totalFired || 0);
      reports.push({ mode: 'frame', report: r });
      console.log(`FRAME_DONE: fired=${r.scenes?.filter(s => s.fired).length}/${spec.frameScenes.length}`);
    } catch (_) { console.log('WARN: no frame report'); }
  }

  // --- Phase 2: Char scenes (Thành phần) ---
  if (spec.charScenes && spec.charScenes.length) {
    console.log(`\n=== PHASE 2: THÀNH PHẦN — ${spec.charScenes.length} cảnh ===`);
    const charSpec = {
      project: spec.project,
      character: spec.character,
      promptTemplate: spec.promptTemplate,
      expectConfig: spec.expectConfig,
      scenes: spec.charScenes
    };
    const charSpecPath = path.join(outDir, '_char-scenes.json');
    const charReport = path.join(outDir, 'fire-char-report.json');
    fs.writeFileSync(charSpecPath, JSON.stringify(charSpec, null, 2));

    // flow-fire-char.js handles tab switch (Thành phần) internally via attachIngredient —
    // NO separate config call needed here (avoids redundant config + potential tab mismatch).
    await run('flow-fire-char.js', [charSpecPath, charReport]);
    try {
      const r = JSON.parse(fs.readFileSync(charReport, 'utf8'));
      totalFired += (r.totalFired || 0);
      reports.push({ mode: 'char', report: r });
      console.log(`CHAR_DONE: fired=${r.scenes?.filter(s => s.fired).length}/${spec.charScenes.length}`);
    } catch (_) { console.log('WARN: no char report'); }
  }

  // --- Phase 3: Wait + Download ---
  if (totalFired > 0) {
    console.log(`\n=== PHASE 3: POLL + DOWNLOAD — totalFired=${totalFired} ===`);
    const allIds = [];
    for (const { report } of reports) {
      for (const s of (report.scenes || [])) {
        for (const wf of (s.workflowIds || [])) allIds.push(wf);
      }
    }

    // Adaptive poll: 15s early, longer later
    await run('flow-status.js', [spec.project, '15']);

    if (allIds.length) {
      const idsPath = path.join(outDir, '_all-ids.json');
      fs.writeFileSync(idsPath, JSON.stringify(allIds));
      await run('flow-download.js', [spec.project, outDir, String(allIds.length), idsPath]);
    } else {
      const totalExpected = ((spec.frameScenes?.length || 0) + (spec.charScenes?.length || 0)) * 4;
      await run('flow-download.js', [spec.project, outDir, String(totalExpected)]);
    }
  }

  // --- Summary ---
  const mp4s = fs.readdirSync(outDir).filter(f => f.endsWith('.mp4'));
  const summary = {
    project: spec.project,
    frameScenes: spec.frameScenes?.length || 0,
    charScenes: spec.charScenes?.length || 0,
    totalFired,
    clipsDownloaded: mp4s.length,
    reports,
    finishedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outDir, 'mixed-job-report.json'), JSON.stringify(summary, null, 2));
  console.log(`\nMIXED_JOB_DONE: ${mp4s.length} clips downloaded to ${outDir}`);
  process.exit(mp4s.length > 0 ? 0 : 1);
})();
