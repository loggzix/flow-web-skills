// flow-download.js — tai hang loat video cua project Flow dang mo ve thu muc.
// Usage: node flow-download.js <projectId> <outDir> [maxCount] [idsFile]
// idsFile: JSON array editId — chi tai dung cac clip nay (job song song khong dinh clip la).
// Lay src truc tiep tu grid (media.getMediaUrlRedirect), fetch bang cookie cua browser.
const pw = require('playwright-core');
const lib = require('./flow-lib');
const fs = require('fs');
const path = require('path');

const [, , projectId, outDir, maxArg, idsFile] = process.argv;
if (!projectId || !outDir) { console.error('USAGE: node flow-download.js <projectId> <outDir> [maxCount] [idsFile]'); process.exit(1); }
const MAX = parseInt(maxArg, 10) || Infinity;
const WANT = idsFile ? new Set(JSON.parse(fs.readFileSync(idsFile, 'utf8'))) : null;
const editIdOf = it => it.edit ? it.edit.split('/edit/')[1].split(/[/?#]/)[0] : null;

(async () => {
  const browser = await pw.chromium.connectOverCDP(lib.CDP);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(`/project/${projectId}`));
  if (!page) {
    page = ctx.pages().find(p => p.url().includes('labs.google/fx')) || await ctx.newPage();
    await page.goto(`https://labs.google/fx/vi/tools/flow/project/${projectId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
  }

  const videoFilter = page.locator('[role="tab"], button').filter({ hasText: /videocam|Xem video/ }).first();
  if (await videoFilter.count()) { try { await videoFilter.click({ timeout: 5000 }); await page.waitForTimeout(2000); } catch (_) {} }

  // Grid Flow la VIRTUALIZED list: tile ngoai khung nhin bi unmount → cuon tung buoc tu dinh xuong, GOM item dan.
  const collectMounted = () => page.evaluate(() => {
    const batch = [...document.querySelectorAll('video')].map(v => {
      let el = v, edit = null, label = '';
      for (let i = 0; i < 10 && el; i++) {
        const a = el.querySelector && el.querySelector('a[href*="/edit/"]');
        if (el.tagName === 'A' && el.href.includes('/edit/')) edit = el.href;
        else if (a) edit = a.href;
        if (edit) break;
        el = el.parentElement;
      }
      let p = v.parentElement;
      for (let i = 0; i < 6 && p; i++) { if (p.innerText && p.innerText.trim().length > 30) { label = p.innerText.trim().slice(0, 80); break; } p = p.parentElement; }
      return { src: v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src) || null, edit, label };
    }).filter(x => x.src);
    const scs = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 200);
    const sc = scs.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    let atEnd = true;
    if (sc) { const t = sc.scrollTop; sc.scrollTop = t + sc.clientHeight * 0.8; atEnd = sc.scrollTop <= t; }
    return { batch, atEnd };
  });

  await page.evaluate(() => {
    const scs = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 200);
    const sc = scs.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (sc) sc.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  const byKey = new Map();
  let idle = 0;
  for (let i = 0; i < 80 && idle < 3; i++) {
    const { batch, atEnd } = await collectMounted();
    const before = byKey.size;
    batch.forEach(x => byKey.set(x.edit || x.src, x));
    idle = (byKey.size === before && atEnd) ? idle + 1 : 0;
    if (WANT) {
      const got = [...byKey.values()].filter(x => WANT.has(editIdOf(x))).length;
      if (got >= WANT.size) break;
    } else if (byKey.size >= MAX && MAX !== Infinity) break;
    await page.waitForTimeout(350);
  }
  let items = [...byKey.values()];
  if (WANT) {
    items = items.filter(x => WANT.has(editIdOf(x)));
    console.log(`FOUND ${items.length}/${WANT.size} clip theo idsFile (grid gom ${byKey.size})`);
  } else console.log('FOUND', items.length, 'video src');
  if (!items.length) {
    const html = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.outerHTML.slice(0, 400) : 'NO_VIDEO_EL'; });
    console.log('PROBE:', html);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(outDir, 'manifest.json');
  // RESUME: clip da tai (theo editId trong ten file) → bo qua, khoi tai lai khi job bi cat giua chung.
  const doneHex = new Set(fs.readdirSync(outDir).filter(f => /^video_\d+_[0-9a-f]{8}\.mp4$/.test(f)).map(f => f.split('_')[2].slice(0, 8)));
  const jobs = items.slice(0, MAX).map((it, i) => ({ ...it, n: i + 1 }))
    .filter(j => !doneHex.has((editIdOf(j) || '').slice(0, 8)));
  if (doneHex.size) console.log(`RESUME: bo qua ${doneHex.size} clip da co, tai ${jobs.length} clip con lai.`);
  const results = [];
  let fail = 0;
  // Ghi manifest TANG DAN: job bi terminal cat (~60s) van co manifest phan anh clip da tai + resume duoc.
  const flushManifest = () => {
    const done = fs.readdirSync(outDir).filter(f => /^video_\d+_[0-9a-f]{8}\.mp4$/.test(f)).sort();
    const seen = new Map(results.map(r => [r.file, r]));
    const man = done.map(f => seen.get(f) || { file: f, editId: f.split('_')[2].slice(0, 8), bytes: fs.statSync(path.join(outDir, f)).size });
    fs.writeFileSync(manifestPath, JSON.stringify(man, null, 2));
  };
  // CDN Google reset khi qua nhieu ket noi song song → giu 8 luong (optimized for performance).
  const CONCURRENCY = 8;
  async function fetchOne(job) {
    const url = job.src.startsWith('http') ? job.src : 'https://labs.google' + job.src;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await ctx.request.get(url, { timeout: 120000, maxRedirects: 10 });
        if (!resp.ok()) throw new Error(`HTTP ${resp.status()}`);
        return await resp.body();
      } catch (e) {
        if (attempt === 3) throw e;
        await new Promise(r => setTimeout(r, 800 * attempt));
      }
    }
  }
  async function worker() {
    let job;
    while ((job = jobs.shift())) {
      const editId = editIdOf(job) || String(job.n).padStart(2, '0');
      const file = path.join(outDir, `video_${String(job.n).padStart(2, '0')}_${editId.slice(0, 8)}.mp4`);
      try {
        const buf = await fetchOne(job);
        fs.writeFileSync(file, buf);
        results.push({ n: job.n, file: path.basename(file), editId, bytes: buf.length, label: job.label });
        console.log(`SAVED ${path.basename(file)} ${(buf.length / 1e6).toFixed(1)}MB`);
        flushManifest();
      } catch (e) { console.log(`FAIL ${job.n}:`, e.message.split('\n')[0]); fail++; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  flushManifest();
  const total = fs.readdirSync(outDir).filter(f => /^video_\d+_[0-9a-f]{8}\.mp4$/.test(f)).length;
  console.log(`DONE saved=${results.length} (tong ${total} tren dia) fail=${fail} dir=${outDir}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
