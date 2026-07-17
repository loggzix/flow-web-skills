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

  // Listen to page console to capture evaluate logs
  page.on('console', msg => {
    if (msg.text().includes('Submenu') || msg.text().includes('match') || msg.text().includes('disabled')) {
      console.log(`[PAGE_CONSOLE] ${msg.text()}`);
    }
  });

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
  // Resolution config from env (default 1080p, supported: 720p, 1080p, 4k)
  const RESOLUTION = process.env.FLOW_RESOLUTION || '1080p';
  const CONCURRENCY = 4; // Right-click download needs lower concurrency to avoid DOM menu race/overlap
  const pendingUpscaleJobs = [];

  // Reset scroll to top before starting downloads to bring new videos into view
  await page.evaluate(() => {
    const scs = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 100 && e.clientHeight > 200);
    const sc = scs.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (sc) sc.scrollTop = 0;
  });
  await page.waitForTimeout(500);

  // Listen to network request to detect upscale triggers
  let isUpscaleRequestFired = false;
  ctx.on('request', r => {
    if (r.url().includes('batchAsyncGenerateVideoUpsampleVideo')) {
      isUpscaleRequestFired = true;
    }
  });

  async function worker() {
    let job;
    while ((job = jobs.shift())) {
      const editId = editIdOf(job);
      if (!editId) continue;

      const file = path.join(outDir, `video_${String(job.n).padStart(2, '0')}_${editId.slice(0, 8)}.mp4`);
      
      try {
        // Find the anchor link first (always present in virtual list metadata)
        let anchor = page.locator(`a[href*="/edit/${editId}"]`);
        
        // Wait up to 5 seconds for Flow UI to mount the new video DOM element if not found immediately
        if (!(await anchor.count())) {
          console.log(`[DL] Waiting 5s for tile ${editId.slice(0, 8)} to render in DOM...`);
          await page.waitForTimeout(5000);
        }

        if (await anchor.count()) {
          await anchor.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(200);
        }

        // Find the media element (video or image thumbnail) directly inside the edit link
        const media = anchor.locator('video, img').first();

        if (!(await media.count())) {
          console.log(`FAIL ${job.n}: No media element (video/img) found for ${editId.slice(0, 8)}`);
          fail++;
          continue;
        }

        // Wait for media src to be ready
        const srcReady = await lib.pollUntil(page, async () => {
          const src = await media.getAttribute('src').catch(() => '');
          return src && (src.startsWith('/fx/') || src.startsWith('blob:') || src.startsWith('http') || src.includes('googleusercontent'));
        }, 8000, 200);

        if (!srcReady) {
          console.log(`FAIL ${job.n}: Media src is not ready/loaded for ${editId.slice(0, 8)}`);
          fail++;
          continue;
        }

        // Right-click target media via dispatchEvent at the center coordinates
        await media.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {});
        await media.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          el.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 2
          }));
        });
        
        // Wait for Radix context menu to appear
        const menu = page.locator('[role="menu"]').first();
        await menu.waitFor({ state: 'visible', timeout: 5000 });

        // Hover over "Tải xuống" or "Download" sub-trigger using direct DOM events
        const dlTrigger = menu.locator('[role="menuitem"][aria-haspopup="menu"]').filter({ hasText: /Tải xuống|Download/ }).first();
        if (!(await dlTrigger.count())) {
          console.log(`FAIL ${job.n}: Download submenu trigger not found`);
          await page.keyboard.press('Escape').catch(() => {});
          fail++;
          continue;
        }

        const triggerFound = await dlTrigger.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const pointerOpts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse' };
          const mouseOpts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
          
          el.dispatchEvent(new PointerEvent('pointerover', pointerOpts));
          el.dispatchEvent(new PointerEvent('pointerenter', pointerOpts));
          el.dispatchEvent(new PointerEvent('pointermove', pointerOpts));
          el.dispatchEvent(new MouseEvent('mouseover', mouseOpts));
          el.dispatchEvent(new MouseEvent('mouseenter', mouseOpts));
          el.dispatchEvent(new MouseEvent('mousemove', mouseOpts));
          el.focus();
          
          // Also click to force submenu open on some Radix versions
          el.click();
          return true;
        }).catch(() => false);

        if (!triggerFound) {
          console.log(`FAIL ${job.n}: Download submenu trigger failed to hover`);
          await page.keyboard.press('Escape').catch(() => {});
          fail++;
          continue;
        }
        await page.waitForTimeout(400);

        // Wait for Radix submenu
        const submenu = page.locator('[role="menu"]').nth(1);
        await submenu.waitFor({ state: 'visible', timeout: 5000 });

        // Fallback chain based on requested resolution
        const requested = RESOLUTION.toLowerCase();
        let clicked = false;
        let finalRes = '720p';

        // Trigger Playwright's download event listener before clicking
        const downloadPromise = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);

        // Reset the network upscale request flag before trigger click
        isUpscaleRequestFired = false;

        // Click the option directly inside the browser DOM
        const clickResult = await submenu.evaluate((subEl, resolutionStr) => {
          const items = Array.from(subEl.querySelectorAll('[role="menuitem"]'));
          const requested = (resolutionStr || '1080p').toLowerCase();
          const chainRes = requested === '4k' 
            ? ['4k', '1080p', '720p'] 
            : (requested === '1080p' ? ['1080p', '720p'] : ['720p']);

          for (const res of chainRes) {
            const opt = items.find(item => {
              const text = (item.textContent || '').trim().toLowerCase();
              return text.includes(res);
            });
            if (opt) {
              if (opt.getAttribute('aria-disabled') === 'true') {
                continue;
              }
              opt.click();
              return { success: true, res };
            }
          }
          return { success: false };
        }, RESOLUTION);

        if (clickResult && clickResult.success) {
          // Wait briefly to see if network request or download fires
          const outcome = await Promise.race([
            downloadPromise.then(dl => ({ type: 'download', dl })),
            // Watch the network flag (wait max 3s)
            lib.pollUntil(page, () => isUpscaleRequestFired ? { type: 'upscale' } : null, 3000, 100),
            // Fallback timeout
            page.waitForTimeout(2800).then(() => ({ type: 'timeout' }))
          ]).catch(() => ({ type: 'timeout' }));

          if (outcome && outcome.type === 'upscale') {
            console.log(`[DL] Network confirmed Upscale job generated on Google Server for ${editId.slice(0, 8)}. Waiting...`);
            // Close the Radix popup toast if it appears (top right)
            await page.waitForTimeout(500);
            const closeBtn = page.locator('button:has-text("Đóng"), button:has-text("Close")').first();
            if (await closeBtn.count()) {
              await closeBtn.click().catch(() => {});
            }
            job.needsUpscaleWait = true;
            pendingUpscaleJobs.push(job); // push to temporary queue for second pass
            clicked = true;
          } else if (outcome && outcome.type === 'download' && outcome.dl) {
            await outcome.dl.saveAs(file);
            const bytes = fs.statSync(file).size;
            results.push({ n: job.n, file: path.basename(file), editId, bytes, label: job.label });
            console.log(`SAVED ${path.basename(file)} [${clickResult.res}] ${(bytes / 1e6).toFixed(1)}MB`);
            flushManifest();
            clicked = true;
            finalRes = clickResult.res;
          } else {
            // Timeout or no event caught - might be already upscaled but click didn't trigger download immediately,
            // or network was slow. Retry as download fallback.
            console.log(`[DL] No network response or download for ${editId.slice(0, 8)}, retrying download...`);
            job.needsUpscaleWait = true;
            pendingUpscaleJobs.push(job);
            clicked = true;
          }
        }

        // Escape if menu still open
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(150);

        if (!clicked) {
          console.log(`FAIL ${job.n}: No available resolution matched for ${RESOLUTION}`);
          fail++;
        }

      } catch (e) {
        console.log(`FAIL ${job.n} (${editId.slice(0, 8)}):`, e.message.split('\n')[0]);
        await page.keyboard.press('Escape').catch(() => {});
        fail++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  // --- SECOND PASS: Download upscaled videos after waiting ---
  if (pendingUpscaleJobs.length > 0) {
    console.log(`[DL] Triggered upscale for ${pendingUpscaleJobs.length} clips. Pausing 90s for server render...`);
    await page.waitForTimeout(90000);
    // Push pending jobs back to main queue
    jobs.push(...pendingUpscaleJobs);
    // Run second pass download
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  }

  flushManifest();
  const total = fs.readdirSync(outDir).filter(f => /^video_\d+_[0-9a-f]{8}\.mp4$/.test(f)).length;
  console.log(`DONE saved=${results.length} (tong ${total} tren dia) fail=${fail} dir=${outDir}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e.message.split('\n')[0]); process.exit(1); });
