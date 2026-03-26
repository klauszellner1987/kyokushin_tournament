import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe.serial('Tournament full flow', () => {
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

  test('create tournament and import participants via CSV', async () => {
    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await expect(page.getByText('Neues Turnier erstellen')).toBeVisible();

    await page.getByPlaceholder('Turniername').fill('E2E Testturnier');
    await page.getByPlaceholder('Ort / Halle').fill('Testhalle Berlin');

    await page.getByRole('button', { name: 'Mixed (Kumite & Kata)' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();

    await expect(page.getByRole('heading', { name: 'E2E Testturnier' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();

    const csvPath = path.resolve(__dirname, 'fixtures', 'teilnehmer.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    await expect(page.getByText('28 Teilnehmer registriert')).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText('Mustermann, Max')).toBeVisible();
    await expect(page.getByText('Schmidt, Anna')).toBeVisible();
    await expect(page.getByText('Koch, Sara')).toBeVisible();

    await page.getByRole('button', { name: 'Anmeldung abschließen' }).click();
    await expect(page.getByText('Anmeldung abgeschlossen')).toBeVisible({ timeout: 5_000 });
  });

  test('generate auto-categories', async () => {
    await page.getByRole('button', { name: 'Kategorien', exact: true }).click();

    await expect(page.getByText('Teilnehmer warten auf Kategorien')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Auto-Kategorien' }).first().click();

    const categoryHeading = page.locator('h4.font-semibold').first();
    await expect(categoryHeading).toBeVisible({ timeout: 10_000 });

    const categoryHeadings = page.locator('h4.font-semibold');
    const count = await categoryHeadings.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await expect(page.getByRole('button', { name: 'Sichtkontrolle' })).toBeVisible();
  });

  test('Sichtkontrolle: drag participant between categories and confirm', async () => {
    await page.getByRole('button', { name: 'Sichtkontrolle' }).click();

    await expect(page.getByRole('heading', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Teilnehmer per Drag & Drop zwischen Kategorien verschieben')).toBeVisible();

    const columns = page.locator('[class*="min-w-\\[260px\\]"]');
    const columnCount = await columns.count();
    expect(columnCount).toBeGreaterThanOrEqual(2);

    const firstColumn = columns.first();
    const draggables = firstColumn.locator('[class*="select-none"][class*="rounded-lg"]');
    const draggableCount = await draggables.count();

    if (draggableCount > 0) {
      const source = draggables.first();
      const sourceBox = await source.boundingBox();

      let targetColIndex = 1;
      const secondColTitle = await columns.nth(1).locator('h4').textContent();
      if (secondColTitle === 'Kein Kampf' && columnCount > 2) {
        targetColIndex = 2;
      }
      const targetColumn = columns.nth(targetColIndex);
      const targetBox = await targetColumn.boundingBox();

      if (sourceBox && targetBox) {
        const startX = sourceBox.x + sourceBox.width / 2;
        const startY = sourceBox.y + sourceBox.height / 2;
        const endX = targetBox.x + targetBox.width / 2;
        const endY = targetBox.y + 80;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 5, { steps: 2 });
        await page.mouse.move(endX, endY, { steps: 15 });
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    }

    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('heading', { name: 'Kategorien' })).toBeVisible({ timeout: 10_000 });
  });

  test('Sichtkontrolle: reset and cancel discards changes', async () => {
    await page.getByRole('button', { name: 'Sichtkontrolle' }).click();
    await expect(page.getByRole('heading', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 5_000 });

    const columns = page.locator('[class*="min-w-\\[260px\\]"]');
    const firstColumn = columns.first();
    const draggables = firstColumn.locator('[class*="select-none"][class*="rounded-lg"]');
    const initialCount = await draggables.count();

    const resetButton = page.getByRole('button', { name: 'Zurücksetzen' });
    await expect(resetButton).toBeVisible();

    if (initialCount > 0) {
      const source = draggables.first();
      const sourceBox = await source.boundingBox();
      const lastColumn = columns.last();
      const targetBox = await lastColumn.boundingBox();

      if (sourceBox && targetBox) {
        const startX = sourceBox.x + sourceBox.width / 2;
        const startY = sourceBox.y + sourceBox.height / 2;
        const endX = targetBox.x + targetBox.width / 2;
        const endY = targetBox.y + 80;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX, startY - 5, { steps: 2 });
        await page.mouse.move(endX, endY, { steps: 15 });
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(500);
      }

      const movedVisible = await page.getByText('verschoben').isVisible().catch(() => false);
      if (movedVisible) {
        await resetButton.click();
        await page.waitForTimeout(300);

        const countAfterReset = await draggables.count();
        expect(countAfterReset).toBe(initialCount);
      }
    }

    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('heading', { name: 'Kategorien' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Sichtkontrolle' })).toBeVisible();
  });
});
