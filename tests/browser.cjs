// Run against the local site: NODE_PATH=<directory containing playwright> node tests/browser.cjs
// All form-delivery requests are intercepted; no email is sent.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  let nativeSubmission = null;
  await context.route('https://formsubmit.co/**', route => {
    nativeSubmission = { url: route.request().url(), method: route.request().method(), body: route.request().postData() };
    return route.fulfill({ contentType: 'text/html', body: '<p>Test interception. No email sent.</p>' });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const base = process.env.SITE_URL || 'http://127.0.0.1:4173';
  const output = path.join(process.cwd(), '.preview');
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => [...document.fonts].filter(font => font.status === 'loaded').length), 6, 'All fonts should load locally');
    assert.deepEqual(await page.locator('main > header, main > section').evaluateAll(nodes => nodes.map(n => n.id)),
      ['sakums', 'aktualitates', 'par-mums', 'lmda', 'kontakti']);
    assert.equal(await page.getByText('Deja, kas turpinās jau 30 gadus', { exact: true }).count(), 1);
    assert.equal(await page.locator('.hero .hero-slogan').count(), 1);
    assert.equal(await page.locator('.hero-slogan').evaluate(el => getComputedStyle(el).textTransform), 'uppercase');
    assert.equal(await page.locator('nav ul a').first().evaluate(el => getComputedStyle(el).fontSize), '16px');
    assert.equal(await page.locator('.news-grid .card').count(), 3);
    assert.equal(await page.locator('[data-open-application]').count(), 1, 'Only the hero opens registration');
    assert.equal(await page.locator('.stats div').last().textContent(), '400+dejotāju studijā');
    // Check real computed hover states, including the formerly static outline button.
    for (const selector of ['.hero .btn', '.about-toggle', '.lmda .btn', '.news-link', '.info > .btn', '.mapfb .btn']) {
      const control = page.locator(selector).first();
      await page.mouse.move(0, 0);
      const before = await control.evaluate(el => getComputedStyle(el).backgroundColor);
      await control.hover();
      await page.waitForFunction(({ selector, before }) => getComputedStyle(document.querySelector(selector)).backgroundColor !== before, { selector, before });
    }
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('#studija').isVisible(), false);
    await page.getByRole('button', { name: 'Skatīt vairāk', exact: true }).click();
    await page.waitForFunction(() => {
      const content = document.querySelector('#studija');
      const animation = content.getAnimations()[0];
      return animation && animation.currentTime > 50 && content.clientHeight > 0 && content.clientHeight < content.scrollHeight;
    });
    await page.waitForFunction(() => document.querySelector('#studija').getAnimations().length === 0);
    assert.equal(await page.locator('#studija').isVisible(), true);
    assert.equal(await page.locator('.styles .card').count(), 4);
    await page.getByRole('button', { name: 'Rādīt mazāk', exact: true }).click();
    // Rapid re-opening during collapse must not let the old animation hide the panel.
    await page.locator('.about-toggle').evaluate(el => el.click());
    await page.waitForFunction(() => document.querySelector('#studija').getAnimations().length === 0);
    assert.equal(await page.locator('#studija').isVisible(), true);
    await page.getByRole('button', { name: 'Rādīt mazāk', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#studija').hidden);
    await page.getByRole('link', { name: 'Skatīt deju virzienus' }).click();
    assert.equal(await page.locator('#virzieni').isVisible(), true);
    await page.goto(base + '/#filiales');
    assert.equal(await page.locator('#filiales').isVisible(), true);
    await page.goto(base);

    for (const width of [320, 375, 560, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth > innerWidth,
        heading: document.querySelector('.hero h1').scrollWidth > document.querySelector('.hero h1').clientWidth
      }));
      assert.equal(overflow.document, false, `Page overflow at ${width}px`);
      assert.equal(overflow.heading, false, `Hero title overflow at ${width}px`);
      if ([375, 1440].includes(width)) await page.screenshot({ path: path.join(output, `site-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Izvēlne' }).click();
    assert.equal(await page.getByRole('navigation').getByRole('link', { name: 'Kontakti' }).isVisible(), true);
    await page.getByRole('navigation').getByRole('link', { name: 'Kontakti' }).click();
    assert.equal(await page.getByRole('button', { name: 'Izvēlne' }).getAttribute('aria-expanded'), 'false');

    const openForm = async () => {
      await page.locator('.hero [data-open-application]').click();
      assert.equal(await page.locator('#application-dialog').isVisible(), true);
    };
    const fillForm = async () => {
      await page.locator('#app-name').fill('Pārbaudes Lietotājs');
      await page.locator('#app-email').fill('test@example.invalid');
      await page.locator('#app-phone').fill('+371 20000000');
      await page.locator('#app-city').selectOption('Daugavpils');
      await page.locator('[name="consent"]').check();
    };
    await openForm();
    await page.screenshot({ path: path.join(output, 'form-375.png') });
    assert.equal(await page.locator('.form-submit').textContent(), 'Nosūtīt pieteikumu');
    assert.equal(await page.locator('#application-form').getAttribute('action'), 'https://formsubmit.co/gribudejot_stoptime@inbox.lv');
    assert.equal(await page.locator('#application-form').evaluate(form => form.checkValidity()), false);
    await page.locator('.form-submit').click();
    assert.equal(await page.locator('#form-status').isVisible(), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#application-dialog').isVisible(), false);
    assert.equal(await page.locator('.hero [data-open-application]').evaluate(el => document.activeElement === el), true);

    await openForm();
    await fillForm();
    await page.locator('.form-submit').click();
    await page.waitForURL('https://formsubmit.co/gribudejot_stoptime@inbox.lv');
    assert.equal(nativeSubmission.method, 'POST');
    assert.equal(nativeSubmission.url, 'https://formsubmit.co/gribudejot_stoptime@inbox.lv');
    const nativeFields = new URLSearchParams(nativeSubmission.body);
    assert.equal(nativeFields.get('email'), 'test@example.invalid');
    assert.equal(nativeFields.get('name'), 'Pārbaudes Lietotājs');
    assert.equal(nativeFields.get('consent'), 'yes');
    assert.equal(nativeFields.get('_subject'), 'STOPTIME — pieteikums izmēģinājuma nodarbībai');
    assert.equal(nativeFields.get('_honey'), '');
    assert.equal(nativeFields.has('_captcha'), false, 'Keep CAPTCHA enabled');
    assert.equal(nativeFields.has('_cc'), false, 'No extra recipients');
    await page.goto(base);

    // Activate delivery in this browser only. The endpoint is never contacted.
    await page.route('**/site-config.js', route => route.fulfill({ contentType: 'application/javascript', body:
      'window.STOPTIME_CONFIG = { contactEmail: "stop_time@inbox.lv", formEndpoint: "https://forms.example.invalid/application" };' }));
    let requests = 0;
    let outcome = 'success';
    let posted = '';
    await page.route('https://forms.example.invalid/application', async route => {
      requests++;
      posted = route.request().postData();
      if (outcome === 'network') return route.abort('failed');
      await route.fulfill({ status: outcome === 'success' ? 200 : 422,
        contentType: 'application/json', body: JSON.stringify({ ok: outcome === 'success' }) });
    });
    await page.reload();
    await openForm();
    await fillForm();
    await page.locator('#app-name').fill('   ');
    await page.locator('.form-submit').click();
    assert.equal(requests, 0);
    await page.locator('#app-name').fill('Pārbaudes Lietotājs');
    await page.locator('.form-submit').click();
    await page.locator('#form-status[data-state="success"]').waitFor();
    assert.equal(requests, 1);
    assert(posted.includes('Pārbaudes Lietotājs') && posted.includes('Daugavpils'));
    assert.equal(await page.locator('.form-submit').isDisabled(), true);
    assert.equal(await page.locator('#app-name').inputValue(), '');

    outcome = 'error';
    await fillForm();
    await page.locator('.form-submit').click();
    await page.locator('#form-status[data-state="error"]').waitFor();
    assert.equal(await page.locator('#app-name').inputValue(), 'Pārbaudes Lietotājs');
    assert.equal(await page.locator('.form-submit').isEnabled(), true);
    outcome = 'network';
    await page.locator('.form-submit').click();
    await page.waitForFunction(() => document.querySelector('.form-submit').disabled === false);
    assert.equal(await page.locator('#form-status').getAttribute('data-state'), 'error');
    assert.equal(await page.locator('#app-email').inputValue(), 'test@example.invalid');
    await page.keyboard.press('Escape');

    await page.route('https://www.google.com/maps?**', route => route.fulfill({ contentType: 'text/html', body: '<p>Map request intercepted for testing.</p>' }));
    await page.locator('.mapfb .btn').click();
    assert.equal(await page.locator('.mapbox iframe[title]').count(), 1);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto(base);
    await page.getByRole('button', { name: 'Skatīt vairāk', exact: true }).click();
    assert.equal(await page.locator('#studija').evaluate(el => el.getAnimations().length), 0);
    assert.equal(await page.locator('#studija').isVisible(), true);
    await page.getByRole('button', { name: 'Rādīt mazāk', exact: true }).click();
    assert.equal(await page.locator('#studija').isVisible(), false);
    await page.screenshot({ path: path.join(output, 'site-light.png'), fullPage: true });
    await openForm();
    await page.screenshot({ path: path.join(output, 'form-desktop.png') });
    assert.deepEqual(errors, []);

    const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
    const staticPage = await noJS.newPage();
    await staticPage.goto(base);
    assert.equal(await staticPage.locator('#studija').isVisible(), true);
    assert.equal(await staticPage.getByRole('navigation').getByRole('link', { name: 'Kontakti' }).isVisible(), true);
    assert.match(await staticPage.locator('.hero [data-open-application]').getAttribute('href'), /^mailto:gribudejot_stoptime@inbox\.lv\?/);
    await noJS.close();
    console.log('PASS: section order, slogan, expandable content, deep links, 7 viewport sizes, mobile menu, modal/focus, validation, mocked delivery success/error/network, map, light theme, no-JS fallback. No email sent.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
