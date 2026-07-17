// flow-lib.js — phan dung chung cho flow-fire.js / flow-fire-char.js (CDP 9666).
const pw = require('playwright-core');

const CDP = process.env.FLOW_CDP || 'http://127.0.0.1:9666';

async function connect(project) {
  const browser = await pw.chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes(`/project/${project}`) && !p.url().includes('/character/'))
    || ctx.pages().find(p => p.url().includes('labs.google/fx'))
    || null;
  if (!page) {
    // Tab Flow bi dong → tu mo tab moi thay vi NO_PAGE; gotoProject se navigate.
    console.log('NO_TAB: mo tab moi trong Chrome CDP');
    page = await ctx.newPage();
  }
  return { browser, ctx, page };
}

// Tra { page, editor } — page co the LA TAB MOI neu tab cu crash cung (goto/reload deu chet).
// Truyen ctx de bat duoc nhanh do; khong co ctx thi crash cung se throw nhu cu.
async function gotoProject(page, project, ctx) {
  const url = `https://labs.google/fx/vi/tools/flow/project/${project}`;
  const onProject = page.url().includes(`/project/${project}`) && !page.url().includes('/character/');
  if (!onProject) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  // Tab song lau hay blank/crash ma url van dung → cho ngan, truot thi navigate lai roi cho dai.
  try {
    await page.locator('[data-slate-editor]').first().waitFor({ timeout: onProject ? 12000 : 45000 });
  } catch (_) {
    console.log('PAGE_STALE: khong thay editor — navigate lai project cho trang tre lai');
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (_) {
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (e2) {
        if (!ctx) throw e2;
        console.log('PAGE_DEAD: renderer crash — mo tab moi roi dong tab xac');
        // Mo tab moi TRUOC khi dong tab xac: dong tab cuoi cung la Chrome tu thoat.
        const fresh = await ctx.newPage();
        try { await page.close(); } catch (_) {}
        page = fresh;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }
    }
    await page.locator('[data-slate-editor]').first().waitFor({ timeout: 45000 });
  }
  await page.waitForTimeout(1500);
  return { page, editor: page.locator('[data-slate-editor]') };
}

// Chip config o thanh prompt, vd "Video · 8scrop_9_16x4". expectConfig: mang token phai co (bo qua "Video").
async function checkConfig(page, expectConfig, project) {
  const chip = page.locator('button:has-text("crop_")').last();
  const barText = (await chip.count()) ? ((await chip.textContent()) || 'NO_CHIP') : 'NO_CHIP';
  console.log('CONFIG_CHIP:', barText);
  const ok = !expectConfig || expectConfig.filter(t => t !== 'Video').every(tok => barText.includes(tok));
  if (!ok) console.log('CONFIG_MISMATCH — chay: node tools/flow-config.js', project, '| Can:', expectConfig.join(', '));
  return { barText, ok };
}

// Bat request gen video (ca text-to-video lan reference-to-video), dem entityId trong body.
function trackFires(ctx) {
  const fired = [];
  ctx.on('request', r => {
    const u = r.url();
    if (u.includes('batchAsyncGenerateVideo') && !u.includes('Status')) {
      let entities = 0;
      try {
        const m = (r.postData() || '').match(/entityId/g);
        entities = m ? m.length : 0;
      } catch (_) {}
      fired.push({ url: u.split('/v1/')[1], at: Date.now(), entities });
    }
  });
  return fired;
}

// Bat workflowId tu RESPONSE 200 cua request gen: moi video 1 response, mediaTitle = FULL prompt
// → map canh↔editId tuyet doi, khong phu thuoc poll status (poll bo sot video xong nhanh).
// Response 403 (reCAPTCHA...) bi page tu retry nen chi log, khong ghi.
function trackBirths(ctx, projectId) {
  const born = [];
  ctx.on('response', async r => {
    const u = r.url();
    if (!u.includes('batchAsyncGenerateVideo') || u.includes('Status')) return;
    if (r.status() !== 200) { born.last403At = Date.now(); console.log(`GEN_HTTP_${r.status()} (page tu retry)`); return; }
    try {
      const j = await r.json();
      const media = j.media || [];
      for (const m of media) {
        if (projectId && m.projectId !== projectId) continue;
        born.push({ workflowId: m.workflowId, title: (m.mediaMetadata && m.mediaMetadata.mediaTitle) || '', at: Date.now() });
      }
      if (!media.length) for (const w of (j.workflows || [])) {
        if (projectId && w.projectId !== projectId) continue;
        born.push({ workflowId: w.name, title: (w.metadata && w.metadata.displayName) || '', at: Date.now() });
      }
    } catch (_) {}
  });
  return born;
}

// Cho response gen ve du: response 200 ve sau request ~3-8s, 403 reCAPTCHA + page retry co the 20-30s.
// expectedCount = so video ky vong (canh fired × xN tu chip) — du thi thoat ngay;
// thieu thi cho toi khi ngung tang 15s lien, tran 90s.
async function waitBirths(page, born, expectedCount) {
  const t0 = Date.now();
  let lastLen = born.length, lastGrow = Date.now();
  while (Date.now() - t0 < 90000) {
    if (expectedCount && born.length >= expectedCount) break;
    await page.waitForTimeout(1000);
    if (born.length !== lastLen) { lastLen = born.length; lastGrow = Date.now(); }
    // 403 sau lan tang cuoi = page dang retry, response ve muon 20-30s → noi idle.
    else if (Date.now() - lastGrow >= (born.last403At && born.last403At > lastGrow ? 35000 : 15000)) break;
  }
  console.log(`BIRTHS: ${born.length}${expectedCount ? '/' + expectedCount : ''} workflow sau ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

// Gan born → scene: uu tien khop FULL title == prompt; fallback theo thoi diem fire gan nhat
// (response ve sau request vai giay, co the lan sang luc canh ke da fire).
function assignBirths(born, scenes, promptOf) {
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const byPrompt = new Map(scenes.map(s => [norm(promptOf(s)), s.id]));
  const out = {};
  for (const s of scenes) out[s.id] = [];
  const unmatched = [];
  for (const w of born) {
    let sid = byPrompt.get(norm(w.title)) || null;
    if (!sid) {
      const prev = scenes.filter(s => s.firedAtMs && s.firedAtMs <= w.at + 500)
        .sort((a, b) => b.firedAtMs - a.firedAtMs)[0];
      sid = prev ? prev.id : null;
    }
    if (sid && out[sid]) out[sid].push(w.workflowId); else unmatched.push(w.workflowId);
  }
  return { bySceneId: out, unmatched };
}

// Go prompt + bam gui, cho den khi request gen xuat hien. Tra {ok, seconds, last, throttled}.
// KHONG BAO GIO throw: throttle server (fire >2 canh x N) → nut Tao mo lau (cap dong thoi,
// nha sau ~20s). Loi click/timeout → tra {ok:false} de caller fire tiep canh sau, KHONG sap ca job.
async function fireScene(page, editor, prompt, fired, waitMs) {
  const t0 = Date.now();
  const firedBefore = fired.length;
  try {
    // Inject prompt truc tiep vao Slate React state qua Page evaluate de tranh Slate reset selection
    const code = `(() => {
      const el = document.querySelector("[data-slate-editor=true]");
      if (!el) return "no editor";
      el.focus();
      const propsKey = Object.keys(el).find(k => k.startsWith("__reactProps"));
      if (!propsKey) return "no props";
      const editor = el[propsKey].children.props.node;
      editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: editor.children[0].children[0].text.length } };
      editor.deleteFragment();
      editor.insertText(${JSON.stringify(prompt)});
      editor.onChange();
      return "injected";
    })()`;
    
    const resEval = await page.evaluate(code);
    console.log('Slate inject:', resEval);
    await page.waitForTimeout(400);

    const sendBtn = page.locator('button:has-text("arrow_forward")').last();
    await sendBtn.waitFor({ state: 'visible', timeout: 10000 });
    // Cho nut enable toi 40s (throttle nha sau ~20s theo do thuc te); mo mai = bo qua canh nay.
    let enabled = false;
    for (let i = 0; i < 130; i++) {
      if (await sendBtn.isEnabled().catch(() => false)) { enabled = true; break; }
      await page.waitForTimeout(300);
    }
    if (!enabled) return { ok: false, throttled: true, seconds: +((Date.now() - t0) / 1000).toFixed(1), last: null };
    
    // Click qua React handler truc tiep de bypass isTrusted click block cua Radix/React
    const clickCode = `(() => {
      const list = Array.from(document.querySelectorAll("button"));
      const arrow = list.find(b => b.querySelector("i")?.textContent === "arrow_forward");
      if (!arrow) return "no arrow";
      const propsKey = Object.keys(arrow).find(k => k.startsWith("__reactProps"));
      if (!propsKey) return "no props";
      arrow[propsKey].onClick({ nativeEvent: { isTrusted: true }, preventDefault: () => {}, stopPropagation: () => {} });
      return "clicked";
    })()`;
    const clickRes = await page.evaluate(clickCode);
    console.log('React click trigger:', clickRes);
  } catch (e) {
    // click bi intercept / timeout khi throttle → coi nhu throttled, KHONG throw.
    return { ok: false, throttled: true, error: e.message.split('\n')[0], seconds: +((Date.now() - t0) / 1000).toFixed(1), last: null };
  }

  const deadline = Date.now() + (waitMs || 30000);
  while (fired.length === firedBefore && Date.now() < deadline) await page.waitForTimeout(200);
  const ok = fired.length > firedBefore;
  return { ok, seconds: +((Date.now() - t0) / 1000).toFixed(1), last: ok ? fired[fired.length - 1] : null };
}

module.exports = { CDP, connect, gotoProject, checkConfig, trackFires, trackBirths, waitBirths, assignBirths, fireScene, pollUntil, clickByLocator };

// Generic poll helper — reused by fire-char, fire-frame, etc.
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

// Click element by text using TRUSTED Playwright locator (not coord-based mouse.click).
// scope: 'dialog' = within [role="dialog"], 'page' = whole document.
// Returns true if clicked, false if not found.
async function clickByLocator(page, scope, needle) {
  const root = scope === 'dialog' ? page.locator('[role="dialog"]') : page;
  // Try exact text match first, then partial
  const candidates = [
    root.getByRole('button', { name: needle }),
    root.getByRole('tab', { name: needle }),
    root.getByRole('option', { name: needle }),
    root.getByRole('menuitem', { name: needle }),
    root.locator(`text="${needle}"`),
  ];
  for (const loc of candidates) {
    if (await loc.first().count()) {
      try {
        await loc.first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
        await loc.first().click({ timeout: 5000 });
        return true;
      } catch (_) { continue; }
    }
  }
  return false;
}
