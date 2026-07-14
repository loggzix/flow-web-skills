const pw = require('playwright-core');
const fs = require('fs');

const [, , descPath, voiceName, outWav] = process.argv;
const CHAR_URL = 'https://labs.google/fx/vi/tools/flow/project/4660f586-d329-48dc-8a1a-3e44234fe0d1/character/1a311aaa-87cc-4d2c-92b8-11aaadb27454';
const SAMPLE = 'Anh ngủ chưa? Em chỉ muốn chúc anh ngủ ngon thôi, mong anh có một giấc mơ thật đẹp nhé.';

(async () => {
  const browser = await pw.chromium.connectOverCDP('http://127.0.0.1:9666');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('labs.google')) || ctx.pages()[0] || await ctx.newPage();
  try {
    for (let i = 0; i < 3; i++) {
      await page.goto(CHAR_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(6000);
      if (page.url().includes('accounts.google')) {
        console.log('NOT_LOGGED_IN');
        process.exit(2);
      }
      if (page.url().includes('/character/')) break;
      console.log('redirected to', page.url(), '- retry', i + 1);
      await page.goto('https://labs.google/fx/vi/tools/flow/project/4660f586-d329-48dc-8a1a-3e44234fe0d1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(6000);
    }

    await page.getByRole('button', { name: /Chọn giọng nói/ }).click({ timeout: 30000 });

    const desc = page.getByPlaceholder('Mô tả giọng nói của nhân vật');
    await desc.waitFor({ timeout: 30000 });
    await desc.fill(fs.readFileSync(descPath, 'utf8').trim());
    await page.getByPlaceholder('Tôi đã sẵn sàng bắt đầu!').fill(SAMPLE);
    await page.waitForTimeout(500);

    const nameBox = page.getByPlaceholder('Giọng nói tuỳ chỉnh của tôi');
    await nameBox.waitFor({ timeout: 15000 });
    await nameBox.fill(voiceName);
    await page.waitForTimeout(500);

    try {
      await page.getByRole('button', { name: /Lưu giọng nói mới/ }).click({ timeout: 8000 });
      console.log('VOICE_SAVED', voiceName);
      await page.waitForTimeout(2500);
    } catch (e) {
      console.log('SAVE_BUTTON_MISS (tiếp tục preview):', e.message.split('\n')[0]);
    }

    const respP = page.waitForResponse(r => r.url().includes('flow-content.google/audio'), { timeout: 120000 });
    await page.getByRole('button', { name: /Xem trước/ }).click({ timeout: 15000 });
    const resp = await respP;
    const body = await resp.body();
    fs.writeFileSync(outWav, body);
    console.log('SAVED', outWav, body.length, 'bytes');
  } catch (e) {
    try { await page.screenshot({ path: 'tools/flow-error.png' }); } catch (_) {}
    console.error('ERR', e.message.split('\n')[0]);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
