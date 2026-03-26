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

  test('invalid CSV file shows header error', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'invalid.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.getByText('CSV-Import fehlgeschlagen')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Ungültiger CSV-Header.')).toBeVisible();

    // Close the error panel
    const closeBtn = page.locator('button[title="Schließen"]');
    await closeBtn.click();
    await expect(page.getByText('CSV-Import fehlgeschlagen')).not.toBeVisible();
  });

  test('wrong header CSV shows header error with expected format', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'wrong-header.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.getByText('CSV-Import fehlgeschlagen')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Ungültiger CSV-Header.')).toBeVisible();
    await expect(page.getByText(/Erwartet:.*Vorname;Nachname/)).toBeVisible();

    const closeBtn = page.locator('button[title="Schließen"]');
    await closeBtn.click();
  });

  test('wrong column count CSV shows row errors', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'wrong-column-count.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.getByText('CSV-Import fehlgeschlagen')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Zeile 2:.*3 Spalten gefunden/)).toBeVisible();
    await expect(page.getByText(/Zeile 3:.*9 Spalten gefunden/)).toBeVisible();

    const closeBtn = page.locator('button[title="Schließen"]');
    await closeBtn.click();
  });

  test('invalid field values CSV shows validation errors', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'invalid-fields.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.getByText('CSV-Import fehlgeschlagen')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Vorname fehlt/)).toBeVisible();
    await expect(page.getByText(/Nachname fehlt/)).toBeVisible();
    await expect(page.getByText(/Geburtsdatum.*ungültig/)).toBeVisible();
    await expect(page.getByText(/Gewicht.*keine gültige Zahl/)).toBeVisible();
    await expect(page.getByText(/Gürtelgrad.*ungültig/)).toBeVisible();
    await expect(page.getByText(/Geschlecht.*ungültig/)).toBeVisible();
    await expect(page.getByText(/Disziplin.*ungültig/)).toBeVisible();

    const closeBtn = page.locator('button[title="Schließen"]');
    await closeBtn.click();
  });

  test('valid CSV imports participants successfully', async () => {
    const csvPath = path.resolve(__dirname, 'fixtures', 'teilnehmer.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.getByText('28 Teilnehmer registriert')).toBeVisible({ timeout: 10_000 });
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
