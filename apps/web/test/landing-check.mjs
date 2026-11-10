import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The live API is used only to verify the existing auth-start redirects locally.
assert.equal(process.env.NODE_ENV, 'test', 'Use the isolated local test environment.');
const database = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(database.hostname));
assert.match(database.pathname, /test|review/i);
const output = '../../test-results/landing';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chromium', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const results = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function inspect(label) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations()
      .filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity)
      .map(animation => animation.finished));
  });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const size = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  const violations = axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) }));
  results.push({ label, size, violations });
  assert.ok(size.page <= size.viewport, `${label}: horizontal overflow`);
  assert.deepEqual(violations, [], `${label}: accessibility failures`);
  console.log('PASS', label);
}

try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('heading', { level: 1, name: /Own your narrative\.\s*Document your work\./ }).waitFor();
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
    assert.equal(await page.locator('article').count(), 3);
    const destinations = await page.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href')));
    assert.deepEqual([...new Set(destinations)].sort(), ['#landing-content', '/', '/api/v1/auth/login', '/api/v1/auth/register', '/workspace'].sort());
    assert.equal(await page.locator('a[href="/api/v1/auth/register"]').count(), 3);
    assert.equal(await page.locator('a[href="/api/v1/auth/login"]').count(), 2);
    assert.match(await page.getByRole('contentinfo').innerText(), /do not establish copyright ownership/);
    await inspect(`landing light ${width}`);
    if ([390, 1440].includes(width)) {
      await page.screenshot({ path: `${output}/landing-${width}.png`, fullPage: true });
      await page.screenshot({ path: `${output}/landing-${width}-viewport.png`, fullPage: false });
    }
  }

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-link').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'landing-content');
  // Native disclosure behavior is exercised by keyboard without a custom JS menu.
  const privacy = page.locator('summary').filter({ hasText: 'Privacy in this pilot' });
  await privacy.focus();
  await page.keyboard.press('Enter');
  assert.equal(await privacy.evaluate(el => el.parentElement.open), true);
  await page.locator('summary').filter({ hasText: 'Pilot terms' }).click();
  await inspect('pilot disclosures expanded');
  results.push({ label: 'keyboard skip link and native privacy disclosure', passed: true });

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await inspect(`landing dark ${width}`);
  }
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await inspect('landing reduced motion');

  const fonts = await page.evaluate(() => ({ heading: getComputedStyle(document.querySelector('h1')).fontFamily, body: getComputedStyle(document.body).fontFamily }));
  assert.match(fonts.heading, /Playfair/);
  assert.match(fonts.body, /Inter/);
  results.push({ label: 'approved fonts', fonts });

  // Stop before the external identity provider; check the unchanged local gateway contract.
  for (const [route, target] of [['login', '/oauth2/authorize'], ['register', '/signup']]) {
    const response = await context.request.get(`http://localhost:3000/api/v1/auth/${route}`, { maxRedirects: 0 });
    assert.equal(response.status(), 302);
    const location = new URL(response.headers().location);
    assert.equal(location.origin, new URL(process.env.AUTH_DOMAIN).origin);
    assert.equal(location.pathname, target);
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(location.searchParams.get('state'));
    assert.ok(location.searchParams.get('code_challenge'));
    results.push({ label: `${route} existing PKCE redirect`, status: response.status(), path: location.pathname });
  }
  await page.getByRole('link', { name: 'Open workspace', exact: false }).click();
  await page.getByRole('heading', { name: 'Start with your identity.' }).waitFor();
  results.push({ label: 'signed-out workspace destination', passed: true });
  assert.deepEqual(errors, []);
} catch (error) {
  results.push({ label: 'failure', error: error.stack });
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(`${output}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
