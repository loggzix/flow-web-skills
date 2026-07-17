// flow-job.js — chay tron ven 1 job video: fire → poll nen → download → dat ten file theo CANH.
// QUY TAC: fire xong KHONG ngoi cho server — chay tool nay o BACKGROUND roi di lam viec khac
// (soan prompt job sau, tao nhan vat, gen anh, upload asset...); no tu bao khi xong.
// Usage: node flow-job.js <scenes.json> <outDir> [report.json]
// scenes.json: nhu flow-fire (text) hoac flow-fire-char (co "character" + "promptTemplate").
// Exit: 0 = du clip + dat ten xong; 1 = loi/thieu; 2 = khong co page; 3 = config lech.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , scenesPath, outDir, reportPath] = process.argv;
if (!scenesPath || !outDir) { console.error('USAGE: node flow-job.js <scenes.json> <outDir> [report.json]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(scenesPath, 'utf8').replace(/^\uFEFF/, ''));
const isChar = !!spec.character;
const REPORT = reportPath || 'tools/last-job-report.json';
const MAP = path.join(outDir, 'media-map.json');
const RESOLUTION = process.env.FLOW_RESOLUTION || '1080p';
const MAX_WAIT = 15 * 60 * 1000;

function run(tool, args, quiet) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, tool), ...args], { encoding: 'utf8', timeout: 15 * 60 * 1000 });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; if (!quiet) process.stdout.write(d); });
    child.stderr.on('data', d => { stderr += d; process.stderr.write(d); });
    child.on('close', code => resolve({ code, out: stdout + stderr }));
    child.on('error', e => resolve({ code: 1, out: e.message }));
  });
}

const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const scenePrompt = sc => isChar ? spec.promptTemplate.replace('<LINE>', sc.line) : sc.prompt;

// Map title (mediaTitle server tra ve) → scene id. Exact truoc (phan biet duoc cac canh
// chung prefix template, chi khac <LINE>); prefix chi la fallback khi title bi cat.
function matchScene(title) {
  if (!title) return null;
  const t = norm(title);
  const exact = spec.scenes.filter(sc => norm(scenePrompt(sc)) === t);
  if (exact.length === 1) return exact[0].id;
  const pre = spec.scenes.filter(sc => {
    const p = norm(scenePrompt(sc));
    const len = Math.min(t.length, p.length);
    return len > 20 && p.slice(0, len) === t.slice(0, len);
  });
  return pre.length === 1 ? pre[0].id : null;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  // outDir tai dung con .mp4 cu → rename se ghi de im lang (py-01_v1.mp4 trung ten) → chan tu dau.
  const oldMp4 = fs.readdirSync(outDir).filter(f => f.endsWith('.mp4'));
  if (oldMp4.length) { console.log(`JOB_ABORT: outDir da co ${oldMp4.length} .mp4 (vd ${oldMp4[0]}) — dung thu muc MOI cho moi job.`); process.exit(1); }
  // Map cu (job truoc / lan chay truoc) ma con lai se dem SUCCESSFUL ao → xoa truoc khi bat dau.
  try { fs.unlinkSync(MAP); } catch (_) {}

  const fireTool = isChar ? 'flow-fire-char.js' : 'flow-fire.js';
  const fireReport = path.join(outDir, 'fire-report.json');
  const f = await run(fireTool, [scenesPath, fireReport]);
  if (f.code === 3) { console.log('JOB_ABORT: config lech'); process.exit(3); }
  if (f.code === 2) { console.log('JOB_ABORT: khong co page'); process.exit(2); }
  let fireData = null;
  try { fireData = JSON.parse(fs.readFileSync(fireReport, 'utf8')); } catch (_) {}
  if (!fireData || !fireData.totalFired) { console.log('JOB_ABORT: khong fire duoc request nao'); process.exit(1); }

  // Nguon chuan: workflowIds bat tu RESPONSE luc fire (fire-report) → biet CHINH XAC editId cua job nay,
  // khong dinh video job khac chay song song, khong phu thuoc poll (poll bo sot video xong nhanh).
  const sceneByWf = {};
  for (const s of (fireData.scenes || [])) for (const wf of (s.workflowIds || [])) sceneByWf[wf] = s.id;
  const mult = parseInt(((fireData.config || '').match(/x(\d+)/) || [])[1], 10) || 4;
  const expected = spec.scenes.length * mult;
  const idsPath = path.join(outDir, 'job-ids.json');
  if (Object.keys(sceneByWf).length < expected)
    console.log(`WARN: bat duoc ${Object.keys(sceneByWf).length}/${expected} workflowId tu fire response — se nhat bo sung tu poll theo title.`);
  console.log(`JOB_FIRED expected=${expected} video (${spec.scenes.length} canh × x${mult}) — poll NGAY, khong cho mu.`);

  // "Het poll" chi dang tin la "xong het" sau >=150s (co canh render xong trong ~70s, co canh 2-3 phut).
  const TRUST_NO_POLLS_AFTER = 150 * 1000;
  const MAX_REFIRES = 1;
  // allowance: tran so wf/canh khi nhat bo sung tu poll — tang them mult moi lan re-fire canh do.
  const allowance = {};
  for (const sc of spec.scenes) allowance[sc.id] = mult;
  const downloadedWfs = new Set();
  const t0 = Date.now();
  let deadline = t0 + MAX_WAIT, lastFireAt = Date.now();
  let rounds = 0, succ = 0, refires = 0, done = false;
  while (Date.now() < deadline) {
    // Adaptive poll interval: 15s first 2min, 30s up to 5min, 45s after (less CDP churn when waiting long renders).
    const elapsed = Date.now() - t0;
    const pollWait = elapsed < 120000 ? '15' : elapsed < 300000 ? '30' : '45';
    const s = await run('flow-status.js', [spec.project, pollWait, MAP, 'nogrid'], true);
    rounds++;
    let map = {};
    try { map = JSON.parse(fs.readFileSync(MAP, 'utf8')); } catch (_) {}
    // Fire response co the bat thieu workflowId (403+retry ve muon) → nhat bo sung tu poll:
    // chi video DANG render trong cua so job nay moi xuat hien o poll, nen match full title an toan
    // (clip cu trung prompt da xong tu truoc, khong vao poll).
    for (const [wf, m] of Object.entries(map)) {
      if (sceneByWf[wf]) continue;
      const sid = matchScene(m.title);
      if (sid && Object.values(sceneByWf).filter(x => x === sid).length < allowance[sid]) sceneByWf[wf] = sid;
    }

    // --- STREAMING DOWNLOAD: Tải gối đầu ngay khi clip xong (Không block vòng lặp poll) ---
    const readyToDownload = [];
    // Read actual directory files to verify presence
    const existingHex = new Set(
      fs.readdirSync(outDir)
        .filter(f => /^video_\d+_[0-9a-f]{8}\.mp4$/.test(f))
        .map(f => f.split('_')[2].slice(0, 8))
    );
    for (const [wf, m] of Object.entries(map)) {
      const shortWf = wf.slice(0, 8);
      if (sceneByWf[wf] && /SUCCESSFUL/.test(m.status || '') && !downloadedWfs.has(wf) && !existingHex.has(shortWf)) {
        readyToDownload.push(wf);
      }
    }
    if (readyToDownload.length > 0) {
      console.log(`STREAMING_DOWNLOAD: Phat hien ${readyToDownload.length} clip render xong. Dang tai nguyen ban...`);
      const streamIdsPath = path.join(outDir, `_stream-ids-${Date.now()}.json`);
      fs.writeFileSync(streamIdsPath, JSON.stringify(readyToDownload));
      
      // Sử dụng await khi tải 1080p/4k để tránh conflict file tạm trên Windows
      if (RESOLUTION !== '720p') {
        await run('flow-download.js', [spec.project, outDir, String(readyToDownload.length), streamIdsPath], true);
        try { fs.unlinkSync(streamIdsPath); } catch (_) {}
      } else {
        run('flow-download.js', [spec.project, outDir, String(readyToDownload.length), streamIdsPath], true)
          .then(() => {
            try { fs.unlinkSync(streamIdsPath); } catch (_) {}
          });
      }

      for (const wf of readyToDownload) {
        downloadedWfs.add(wf);
      }
    }

    // Dem SUCCESSFUL theo TUNG CANH tren dung editId set cua job nay (cap mult/canh —
    // re-fire co the du thua, chi can moi canh du x4).
    const perScene = {};
    for (const sc of spec.scenes) perScene[sc.id] = 0;
    for (const [wf, sid] of Object.entries(sceneByWf))
      if (/SUCCESSFUL/.test((map[wf] || {}).status || '')) perScene[sid]++;
    succ = spec.scenes.reduce((a, sc) => a + Math.min(perScene[sc.id], mult), 0);
    console.log(`POLL_ROUND ${rounds}: mapped=${Object.keys(map).length} (job nay=${Object.keys(sceneByWf).length}) successful=${succ}/${expected}${refires ? ` refires=${refires}` : ''}`);
    if (succ >= expected) { done = true; break; }

    // Poll can (het video dang render) ma van thieu → co canh FAIL/mat tich.
    // allTerm: moi wf cua JOB NAY da terminal — can khi job khac render song song giu poll chay mai.
    // Re-fire dung cac canh thieu 1 lan; van thieu nua thi thoat som thay vi ngoi het MAX_WAIT.
    const wfs = Object.keys(sceneByWf);
    const allTerm = wfs.length >= expected && wfs.every(wf => /SUCCESSFUL|FAIL/.test((map[wf] || {}).status || ''));
    const drained = Date.now() - lastFireAt > TRUST_NO_POLLS_AFTER && (allTerm || /NO_POLLS_EARLY|ALL_TERMINAL/.test(s.out));
    if (drained) {
      const short = spec.scenes.filter(sc => perScene[sc.id] < mult);
      if (!short.length) { done = true; break; }
      if (refires >= MAX_REFIRES) { console.log(`GIVE_UP: ${short.map(sc => sc.id).join(',')} van thieu sau ${refires} lan re-fire.`); break; }
      refires++;
      console.log(`REFIRE ${refires}: ${short.map(sc => `${sc.id}(${perScene[sc.id]}/${mult})`).join(', ')} — render fail/thieu, ban lai.`);
      const subPath = path.join(outDir, 'refire-scenes.json');
      fs.writeFileSync(subPath, JSON.stringify({ ...spec, scenes: short }, null, 2));
      const rfReport = path.join(outDir, 'refire-report.json');
      const rf = await run(fireTool, [subPath, rfReport], true);
      let rfData = null;
      try { rfData = JSON.parse(fs.readFileSync(rfReport, 'utf8')); } catch (_) {}
      if (rf.code >= 2 || !rfData || !rfData.totalFired) { console.log('REFIRE_FAIL: khong ban lai duoc — dung poll.'); break; }
      for (const s2 of (rfData.scenes || [])) for (const wf of (s2.workflowIds || [])) if (!sceneByWf[wf]) sceneByWf[wf] = s2.id;
      for (const sc of short) allowance[sc.id] += mult;
      lastFireAt = Date.now();
      deadline = Date.now() + MAX_WAIT;
    }
  }

  const wanted = Object.keys(sceneByWf);
  const dlArgs = [spec.project, outDir, String(Math.max(expected, wanted.length))];
  if (wanted.length) { fs.writeFileSync(idsPath, JSON.stringify(wanted, null, 1)); dlArgs.push(idsPath); }
  const d = await run('flow-download.js', dlArgs);
  if (d.code !== 0 && !fs.existsSync(path.join(outDir, 'manifest.json'))) {
    console.log('JOB_ABORT: download fail');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
  let map = {};
  try { map = JSON.parse(fs.readFileSync(MAP, 'utf8')); } catch (_) {}
  const counters = {};
  const renamed = [];
  for (const m of manifest) {
    const info = map[m.editId];
    const sceneId = sceneByWf[m.editId] || (info ? matchScene(info.title) : null);
    const base = sceneId || 'unknown';
    counters[base] = (counters[base] || 0) + 1;
    const newName = `${base}_v${counters[base]}.mp4`;
    fs.renameSync(path.join(outDir, m.file), path.join(outDir, newName));
    renamed.push({ file: newName, scene: sceneId, editId: m.editId, bytes: m.bytes });
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(renamed, null, 2));

  const unknown = renamed.filter(r => !r.scene).length;
  // Pass theo TUNG CANH du mult clip (tong so co the du canh nay bu canh kia → khong tin tong).
  const shortScenes = spec.scenes.filter(sc => (counters[sc.id] || 0) < mult).map(sc => sc.id);
  const report = {
    project: spec.project, scenes: spec.scenes.length, expected, downloaded: renamed.length,
    unknownScene: unknown, shortScenes, refires, pollRounds: rounds,
    minutes: +(((Date.now() - t0) / 60000).toFixed(1)), dir: outDir
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`JOB_DONE clips=${renamed.length}/${expected} unknown_scene=${unknown}${shortScenes.length ? ` THIEU=[${shortScenes.join(',')}]` : ''}${refires ? ` refires=${refires}` : ''} sau ${report.minutes} phut | ${outDir}`);
  process.exit(shortScenes.length === 0 && unknown === 0 ? 0 : 1);
})();
