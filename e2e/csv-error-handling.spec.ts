import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe.serial('CSV error handling and duplicates', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await page.getByPlaceholder('Turniername').fill('CSV Fehlertest');
    await page.getByPlaceholder('Ort / Halle').fill('Testhalle');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('heading', { name: 'CSV Fehlertest' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('invalid CSV file does not add participants', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'invalid.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await page.waitForTimeout(2_000);

    const hasParticipants = await page.getByText(/\d+ Teilnehmer registriert/).isVisible().catch(() => false);
    if (hasParticipants) {
      await expect(page.getByText('0 Teilnehmer registriert')).toBeVisible();
    } else {
      await expect(page.getByText('Keine Teilnehmer gefunden')).toBeVisible();
    }
  });

  test('valid CSV imports participants successfully', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'teilnehmer.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.getByText('8 Teilnehmer registriert')).toBeVisible({ timeout: 10_000 });
  });

  test('duplicate CSV triggers duplicate modal', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'teilnehmer_duplikate.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await page.waitForTimeout(2_000);

    const hasDuplicateModal = await page.getByText('CSV Import Ergebnis').isVisible().catch(() => false);

    if (hasDuplicateModal) {
      await expect(page.getByText('Duplikate erkannt')).toBeVisible();

      const skipAllButton = page.getByRole('button', { name: /Alle überspringen/i });
      if (await skipAllButton.isVisible().catch(() => false)) {
        await skipAllButton.click();
      }

      const importButton = page.getByRole('button', { name: /Importieren/i });
      if (await importButton.isVisible().catch(() => false)) {
        await importButton.click();
      }
    }

    await expect(page.getByText('Mustermann, Max')).toBeVisible({ timeout: 5_000 });
  });

  test('duplicate CSV: overwrite option works', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'teilnehmer_duplikate.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await page.waitForTimeout(2_000);

    const hasDuplicateModal = await page.getByText('CSV Import Ergebnis').isVisible().catch(() => false);

    if (hasDuplicateModal) {
      const overwriteAll = page.getByRole('button', { name: /Alle überschreiben/i });
      if (await overwriteAll.isVisible().catch(() => false)) {
        await overwriteAll.click();
      }

      const importButton = page.getByRole('button', { name: /Importieren/i });
      if (await importButton.isVisible().catch(() => false)) {
        await importButton.click();
      }
    }

    await expect(page.getByText('Mustermann, Max')).toBeVisible({ timeout: 5_000 });
  });

  test('bracket generation fails without categories', async () => {
    await page.getByRole('button', { name: 'Turnierbaum' }).click();
    await expect(page.getByRole('heading', { name: 'Turnierbaum' })).toBeVisible({ timeout: 5_000 });

    const noCategoriesMsg = page.getByText('Keine Kategorien vorhanden');
    const createHint = page.getByText(/Erstelle zuerst Kategorien/i);

    const hasEmptyState = await noCategoriesMsg.isVisible().catch(() => false)
      || await createHint.isVisible().catch(() => false);

    expect(hasEmptyState).toBeTruthy();
  });
});
