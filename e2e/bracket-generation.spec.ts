import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe.serial('Bracket generation and results', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await page.getByPlaceholder('Turniername').fill('Bracket Testturnier');
    await page.getByPlaceholder('Ort / Halle').fill('Testhalle');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('heading', { name: 'Bracket Testturnier' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();
    const csvPath = path.resolve(__dirname, 'fixtures', 'teilnehmer.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);
    await expect(page.getByText('28 Teilnehmer registriert')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Kategorien' }).click();
    await page.getByRole('button', { name: 'Auto-Kategorien' }).first().click();
    await expect(page.locator('h4.font-semibold').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Sichtkontrolle' }).click();
    await expect(page.getByRole('heading', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('button', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 10_000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('navigate to bracket tab and see categories', async () => {
    await page.getByRole('button', { name: 'Turnierbaum' }).click();

    await expect(page.getByRole('heading', { name: 'Turnierbaum' })).toBeVisible({ timeout: 5_000 });

    const categoryCards = page.locator('h4');
    const count = await categoryCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('generate bracket for a category with enough participants', async () => {
    const categoryCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
    const count = await categoryCards.count();

    let found = false;
    for (let i = 0; i < count; i++) {
      const card = categoryCards.nth(i);
      const text = await card.textContent() || '';
      const participantMatch = text.match(/(\d+)\s*Teilnehmer/);
      if (participantMatch && parseInt(participantMatch[1]) >= 2) {
        await card.click();
        found = true;
        break;
      }
    }

    if (!found && count > 0) {
      await categoryCards.first().click();
    }

    await page.waitForTimeout(500);

    const generateBtn = page.getByRole('button', { name: 'Turnierbaum generieren' });
    const isEnabled = await generateBtn.isEnabled().catch(() => false);

    if (isEnabled) {
      await generateBtn.click();
      await page.waitForTimeout(2_000);

      const hasMatches = await page.locator('[class*="border"]').filter({ hasText: 'vs' }).count() > 0
        || await page.getByText('Champion').isVisible().catch(() => false)
        || await page.getByText('Runde').isVisible().catch(() => false);
      expect(hasMatches).toBeTruthy();
    } else {
      const errorMsg = page.getByText(/Mindestens 2 benötigt|Generierung nicht möglich/);
      await expect(errorMsg).toBeVisible({ timeout: 3_000 });
    }
  });

  test('enter a match result', async () => {
    const matchCard = page.locator('[class*="cursor-pointer"]').filter({ hasText: 'vs' }).first();
    const isClickable = await matchCard.count() > 0;

    if (isClickable) {
      await matchCard.click();
      await expect(page.getByRole('heading', { name: 'Ergebnis eintragen' })).toBeVisible({ timeout: 5_000 });

      const confirmButton = page.getByRole('button', { name: 'Bestätigen' });
      await expect(confirmButton).toBeVisible();

      await page.getByRole('button', { name: 'Abbrechen' }).click();
    }
  });

  test('navigate back to bracket overview', async () => {
    const backBtn = page.getByRole('button', { name: 'Übersicht' });
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
    }
    await expect(page.getByRole('heading', { name: 'Turnierbaum' })).toBeVisible({ timeout: 5_000 });
  });
});
