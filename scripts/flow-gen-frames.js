// flow-gen-frames.js — BƯỚC 1 automation: batch gen frame ảnh từ ảnh khách.
// Usage: node flow-gen-frames.js <frames.json> [reportPath]
// frames.json: {
//   project: "xxx",              // Flow project ID
//   scenes: [{
//     id: "scene_1",             // scene identifier
//     refImage: "san-pham.jpg",  // alt name of uploaded ref image in project
//     prompt: "sản phẩm trên bàn gỗ, ánh sáng studio, không chữ không watermark"
//   }]
// }
// Prereqs: ref images already uploaded to project (via input[type=file] in browser).
// Config: switches to Image mode (🍌 Nano Banana 2) automatically.
// Output: fire-report with workflowIds mapped to scenes for later QC + download.
// Exit: 0 = all fired; 1 = error; 2 = no page; 3 = config.
const fs = require('fs');
const lib = require('./flow-lib');

const [, , framesPath, reportPath] = process.argv;
if (!framesPath) { console.error('USAGE: node flow-gen-frames.js <frames.json> [report.json]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(framesPath, 'utf8').replace(/^\uFEFF/, ''));
const REPORT = reportPath || 'last-gen-frames-report.json';

async function switchToImageMode(page) {
  // Click config chip → open settings dialog
  const chip = page.locator('button:has-text("crop_")').last();
  if (!(await chip.count())) { console.log('NO_CONFIG_CHIP'); return false; }
  await chip.click({ timeout: 5000 });
  await page.waitForTimeout(500);

  // Click "Hình ảnh" tab/option to switch to image mode
  const clicked = await lib.clickByLocator(page, 'page', 'Hình ảnh');
  if (!clicked) {
    // Try "Image" (English UI)
    await lib.clickByLocator(page, 'page', 'Image');
  }
  await page.waitForTimeout(1000);

  // Verify chip now shows 🍌 (banana = image mode indicator)
  const chipText = await chip.textContent().catch(() => '');
  const isImage = chipText.includes('🍌') || chipText.includes('banana') || chipText.includes('Hình ảnh');
  if (!isImage) console.log(`WARN: chip text "${chipText}" may not be image mode`);
  return true;
}

async function attachRefImage(page, refName) {
  // Open ingredient dialog (add_2 button)
  if (!(await lib.clickByLocator(page, 'page', 'add_2'))) {
    console.log('NO_ADD_BTN');
    return false;
  }
  await page.waitForTimeout(1000);

  // Wait for dialog
  try {
    await page.locator('[role="dialog"]').waitFor({ timeout: 8000 });
  } catch (_) {
    console.log('NO_DIALOG');
    return false;
  }

  // Click "Hình ảnh" tab in dialog
  const tabClicked = await lib.pollUntil(page, () => page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const tabs = [...dlg.querySelectorAll('[role="tab"]')];
    const t = tabs.find(t => t.innerText.includes('Hình ảnh'));
    if (t) { t.click(); return true; }
    return false;
  }), 5000);

  // Find image by alt text = filename
  const found = await lib.pollUntil(page, () => page.evaluate((name) => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const img = dlg.querySelector(`img[alt="${name}"]`) || dlg.querySelector(`img[alt*="${name}"]`);
    if (!img) return false;
    img.scrollIntoView({ block: 'center' });
    img.click();
    return true;
  }, refName), 8000);

  if (!found) {
    console.log(`REF_NOT_FOUND: ${refName}`);
    await page.keyboard.press('Escape');
    return false;
  }

  // Click "Thêm vào câu lệnh"
  await page.waitForTimeout(500);
  await lib.clickByLocator(page, 'dialog', 'Thêm vào câu lệnh');
  await page.waitForTimeout(1000);

  // Close dialog
  if (await page.locator('[role="dialog"]').count()) await page.keyboard.press('Escape');
  await lib.pollUntil(page, async () => !(await page.locator('[role="dialog"]').count()), 3000, 150);
  return true;
}

(async () => {
  const { browser, ctx, page: rawPage } = await lib.connect(spec.project);
  let { page, editor } = await lib.gotoProject(rawPage, spec.project, ctx);

  // Switch to image mode
  await switchToImageMode(page);

  const fired = lib.trackFires(ctx);
  const born = lib.trackBirths(ctx, spec.project);
  const results = [];

  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    console.log(`\nFRAME ${i + 1}/${spec.scenes.length}: ${scene.id} ref=${scene.refImage}`);

    // Attach reference image if specified
    if (scene.refImage) {
      const attached = await attachRefImage(page, scene.refImage);
      if (!attached) {
        console.log(`SKIP_SCENE: ${scene.id} — ref image not attached`);
        results.push({ id: scene.id, fired: false, reason: 'ref_not_found' });
        continue;
      }
    }

    // Fire the prompt
    const r = await lib.fireScene(page, editor, scene.prompt, fired, 30000);
    scene.firedAtMs = Date.now();
    results.push({
      id: scene.id,
      fired: r.ok,
      seconds: r.seconds,
      throttled: r.throttled || false
    });
    console.log(`  ${r.ok ? 'FIRED' : 'MISS'} ${r.seconds}s${r.throttled ? ' (throttled)' : ''}`);

    // Brief pause between scenes
    if (i < spec.scenes.length - 1) await page.waitForTimeout(2000);
  }

  // Wait for births
  const mult = 2; // image mode typically x2
  await lib.waitBirths(page, born, spec.scenes.length * mult);

  // Assign births to scenes
  const { bySceneId, unmatched } = lib.assignBirths(born, spec.scenes, s => s.prompt);
  for (const r of results) r.workflowIds = bySceneId[r.id] || [];

  const totalFired = results.filter(r => r.fired).length;
  const report = {
    project: spec.project,
    mode: 'image-gen-frames',
    totalFired,
    totalScenes: spec.scenes.length,
    births: born.length,
    unmatched,
    scenes: results,
    config: 'Image / Nano Banana 2',
    finishedAt: new Date().toISOString()
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`\nGEN_FRAMES_DONE: fired=${totalFired}/${spec.scenes.length} births=${born.length}`);
  await browser.close().catch(() => {});
  process.exit(totalFired > 0 ? 0 : 1);
})();
