import { test, expect, type Page, type BrowserContext } from '@playwright/test';

async function buyTokenIfNeeded(page: Page) {
  const pricingModal = page.locator('div.fixed').filter({ hasText: 'Turnier-Tokens kaufen' });
  if (await pricingModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await pricingModal.getByRole('button', { name: 'Kaufen' }).first().click();
    await page.waitForTimeout(1_000);
    const closeBtn = pricingModal.locator('button').filter({ has: page.locator('svg') }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Neues Turnier' }).click();
  }
}

test.describe.serial('Tournament management', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('create first tournament (Kumite)', async () => {
    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await buyTokenIfNeeded(page);
    await expect(page.getByText('Neues Turnier erstellen')).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('Turniername').fill('Bayernpokal 2026');
    await page.getByPlaceholder('Ort / Halle').fill('Sporthalle Regensburg');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();

    await expect(page.getByRole('heading', { name: 'Bayernpokal 2026' })).toBeVisible({ timeout: 10_000 });
  });

  test('navigate back and create second tournament (Mixed)', async () => {
    await page.getByRole('link', { name: 'Turniere' }).click();
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('Bayernpokal 2026')).toBeVisible();

    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await buyTokenIfNeeded(page);
    await expect(page.getByText('Neues Turnier erstellen')).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('Turniername').fill('Nordbayern Open');
    await page.getByPlaceholder('Ort / Halle').fill('Arena Nürnberg');
    await page.getByRole('button', { name: 'Mixed (Kumite & Kata)' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();

    await expect(page.getByRole('heading', { name: 'Nordbayern Open' })).toBeVisible({ timeout: 10_000 });
  });

  test('both tournaments visible in list', async () => {
    await page.getByRole('link', { name: 'Turniere' }).click();
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText('Bayernpokal 2026')).toBeVisible();
    await expect(page.getByText('Nordbayern Open')).toBeVisible();
  });

  test('navigate into a tournament and back', async () => {
    await page.getByText('Bayernpokal 2026').click();
    await expect(page.getByRole('heading', { name: 'Bayernpokal 2026' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: 'Turniere' }).click();
    await expect(page.getByText('Nordbayern Open')).toBeVisible({ timeout: 5_000 });
  });

  test('delete a tournament', async () => {
    page.on('dialog', dialog => dialog.accept());

    const cards = page.locator('[class*="cursor-pointer"][class*="rounded-xl"]');
    const card = cards.filter({ hasText: 'Nordbayern Open' });
    await card.locator('button').click();

    await expect(page.getByText('Nordbayern Open')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Bayernpokal 2026')).toBeVisible();
  });
});
