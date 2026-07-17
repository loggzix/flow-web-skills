// flow-status.js — dem trang thai render video cua project Flow dang mo.
// Nghe poll batchCheckAsyncVideoGenerationStatus cua chinh trang, thoat som khi ket luan duoc.
// Usage: node flow-status.js <projectId> [listenSeconds=20] [mapPath] [nogrid]
// mapPath: ghi/merge JSON {workflowId: {title, status}} — workflowId == editId tren grid → map clip↔prompt↔canh.
// nogrid: bo qua man dem grid (cuon-gom ~20-30s voi project lon) — dung khi poll trong vong lap (flow-job).
const pw = require('playwright-core');
const lib = require('./flow-lib');
const fs = require('fs');

const [, , projectId, secsArg, mapPath, gridArg] = process.argv;
const SKIP_GRID = gridArg === 'nogrid';
const LISTEN = (parseInt(secsArg, 10) || 20) * 1000;
const NO_POLL_GIVEUP = 8000; // optimized fallback: if no polls in 8s, switch to grid scan immediately
const IDLE_AFTER_POLL = 7000;

(async () => {
  const browser = await pw.chromium.connectOverCDP(lib.CDP);
  const ctx = browser.contexts()[0];
  let page = projectId ? ctx.pages().find(p => p.url().includes(`/project/${projectId}`)) : null;
  if (!page) page = ctx.pages().find(p => p.url().includes('labs.google/fx'));
  if (!page) { console.log('NO_PAGE'); process.exit(2); }

  const media = {};
  const wfMap = {};
  let polls = 0, sampled = false, lastPollAt = 0;
  ctx.on('response', async r => {
    if (!r.url().includes('batchCheckAsyncVideoGenerationStatus')) return;
    polls++;
    lastPollAt = Date.now();
    try {
      const j = await r.json();
      const findStatus = (obj, depth) => {
        if (!obj || typeof obj !== 'object' || depth > 4) return null;
        for (const [k, v] of Object.entries(obj)) {
          if (/status|state/i.test(k) && typeof v === 'string') return v;
          if (typeof v === 'object') { const hit = findStatus(v, depth + 1); if (hit) return hit; }
        }
        return null;
      };
      const arr = j.media || j.statuses || j.operations || [];
      if (!sampled && arr.length) {
        const m0 = JSON.parse(JSON.stringify(arr[0]));
        if (m0.mediaMetadata && m0.mediaMetadata.mediaTitle) m0.mediaMetadata.mediaTitle = m0.mediaMetadata.mediaTitle.slice(0, 40) + '...';
        console.log('SAMPLE_ENTRY:', JSON.stringify(m0).slice(0, 900));
        sampled = true;
      }
      for (const m of arr) {
        const id = m.name || (m.media && m.media.name) || m.mediaName || JSON.stringify(m).slice(0, 40);
        media[id] = findStatus(m, 0) || 'UNKNOWN';
        if (m.workflowId) {
          wfMap[m.workflowId] = {
            title: (m.mediaMetadata && m.mediaMetadata.mediaTitle) || wfMap[m.workflowId]?.title || '',
            status: media[id]
          };
        }
      }
    } catch (_) {}
  });

  try { await page.bringToFront(); } catch (_) {}
  console.log(`LISTENING (max ${LISTEN / 1000}s) on`, page.url().slice(0, 90));
  const t0 = Date.now();
  let exitReason = 'TIMEOUT';
  while (Date.now() - t0 < LISTEN) {
    await page.waitForTimeout(500);
    const elapsed = Date.now() - t0;
    if (polls === 0 && elapsed >= NO_POLL_GIVEUP) { exitReason = 'NO_POLLS_EARLY'; break; }
    if (polls > 0 && Date.now() - lastPollAt >= IDLE_AFTER_POLL) {
      const sts = Object.values(media);
      if (sts.length && sts.every(s => /SUCCESSFUL|FAILED/.test(s))) { exitReason = 'ALL_TERMINAL'; break; }
    }
  }

  const counts = {};
  for (const st of Object.values(media)) counts[st] = (counts[st] || 0) + 1;
  console.log('POLLS_SEEN:', polls, `(exit=${exitReason} after ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log('MEDIA_TRACKED:', Object.keys(media).length);
  console.log('STATUS_COUNTS:', JSON.stringify(counts, null, 1));
  for (const [id, st] of Object.entries(media)) console.log(' ', id.slice(0, 12), st);
  if (polls === 0) console.log('NO_POLLS — het video dang render (hoac tat ca xong / trang khong o project nay).');

  // GRID FALLBACK FOR MAP: if no polls (finished videos), collect directly from DOM grid to mapPath
  if (polls === 0 && mapPath) {
    try {
      console.log('NO_POLLS_GRID_FALLBACK: scanning DOM grid directly...');
      const videoFilter = page.locator('[role="tab"], button').filter({ hasText: /videocam|Xem video/ }).first();
      if (await videoFilter.count()) { await videoFilter.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1000); }
      
      const gridItems = await page.evaluate(() => {
        return [...document.querySelectorAll('video')].map(v => {
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
          return { edit, label };
        }).filter(x => x.edit);
      });

      let merged = {};
      try { merged = JSON.parse(fs.readFileSync(mapPath, 'utf8')); } catch (_) {}
      for (const item of gridItems) {
        const wf = item.edit.split('/edit/')[1].split(/[/?#]/)[0];
        if (wf) {
          merged[wf] = {
            title: item.label,
            status: 'SUCCESSFUL' // If visible in grid with video tag, it is successfully rendered
          };
        }
      }
      fs.writeFileSync(mapPath, JSON.stringify(merged, null, 2));
      console.log('MAP_WRITTEN_FROM_GRID:', mapPath, `(${Object.keys(merged).length} workflow)`);
    } catch (e) {
      console.log('GRID_FALLBACK_ERR:', e.message.split('\n')[0]);
    }
  }

  if (mapPath) {
    let merged = {};
    try { merged = JSON.parse(fs.readFileSync(mapPath, 'utf8')); } catch (_) {}
    for (const [wf, v] of Object.entries(wfMap)) merged[wf] = { ...merged[wf], ...v };
    fs.writeFileSync(mapPath, JSON.stringify(merged, null, 2));
    console.log('MAP_WRITTEN:', mapPath, `(${Object.keys(merged).length} workflow)`);
  }

  if (SKIP_GRID) { console.log('GRID_SKIPPED (nogrid)'); await browser.close(); return; }
  try {
    const videoFilter = page.locator('[role="tab"], button').filter({ hasText: /videocam|Xem video/ }).first();
    if (await videoFilter.count()) { await videoFilter.click({ timeout: 5000 }); await page.waitForTimeout(2000); }
    // Grid Flow la VIRTUALIZED list trong container con: tile ngoai khung nhin bi unmount.
    // Dem dung = cuon tung buoc tu dinh xuong va GOM dan cac edit-link unique.
    await page.evaluate(() => {
      const scs = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 200);
      const sc = scs.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (sc) sc.scrollTop = 0;
    });
    await page.waitForTimeout(500);
    const seen = new Set();
    let idle = 0;
    for (let i = 0; i < 80 && idle < 3; i++) {
      const r = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href*="/edit/"]')].map(a => a.getAttribute('href'));
        const scs = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 200);
        const sc = scs.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
        let atEnd = true;
        if (sc) { const t = sc.scrollTop; sc.scrollTop = t + sc.clientHeight * 0.8; atEnd = sc.scrollTop <= t; }
        return { links, atEnd };
      });
      const before = seen.size;
      r.links.forEach(l => seen.add(l));
      idle = (seen.size === before && r.atEnd) ? idle + 1 : 0;
      await page.waitForTimeout(350);
    }
    console.log('GRID_VIDEO_TILES (unique edit links, gom khi cuon):', seen.size);
  } catch (e) { console.log('GRID_COUNT_ERR', e.message.split('\n')[0]); }
  await browser.close();
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
