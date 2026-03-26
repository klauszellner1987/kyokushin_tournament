import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe.serial('Workflow guidance banner and tab indicators', () => {
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

  test('new tournament shows "Teilnehmer eintragen" as next step', async () => {
    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await page.getByPlaceholder('Turniername').fill('Workflow Testturnier');
    await page.getByPlaceholder('TT.MM.JJJJ').fill('01.01.2027');
    await page.getByPlaceholder('Ort / Halle').fill('Testhalle');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('heading', { name: 'Workflow Testturnier' })).toBeVisible({ timeout: 10_000 });

    const banner = page.getByText('Mind. 2 Teilnehmer eintragen');
    await expect(banner).toBeVisible({ timeout: 5_000 });
  });

  test('banner click navigates to the correct tab', async () => {
    const banner = page.locator('[role="status"]').filter({ hasText: 'Nächster Schritt' });
    await banner.click();

    const participantTab = page.getByRole('button', { name: 'Teilnehmer', exact: true });
    await expect(participantTab).toHaveClass(/border-kyokushin-red/);
  });

  test('after importing participants, banner shows "Anmeldung abschließen"', async () => {
    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();

    const csvPath = path.resolve(__dirname, 'fixtures', 'teilnehmer.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);
    await expect(page.getByText('28 Teilnehmer registriert')).toBeVisible({ timeout: 10_000 });

    const banner = page.getByText('Anmeldung abschließen').first();
    await expect(banner).toBeVisible({ timeout: 5_000 });
  });

  test('closing registration advances to categories step', async () => {
    const closeBtn = page.getByRole('button', { name: 'Anmeldung abschließen' });
    await closeBtn.click();

    await expect(page.getByText('Anmeldung abgeschlossen')).toBeVisible({ timeout: 5_000 });

    const banner = page.getByText('Kategorien erstellen');
    await expect(banner).toBeVisible({ timeout: 5_000 });
  });

  test('participants tab shows green indicator after registration closed', async () => {
    const participantTab = page.getByRole('button', { name: 'Teilnehmer', exact: true });
    const greenDot = participantTab.locator('span.bg-green-500');
    await expect(greenDot).toBeVisible();
  });

  test('reopening registration removes green indicator', async () => {
    const reopenBtn = page.getByRole('button', { name: 'Wieder öffnen' });
    await reopenBtn.click();

    const participantTab = page.getByRole('button', { name: 'Teilnehmer', exact: true });
    const greenDot = participantTab.locator('span.bg-green-500');
    await expect(greenDot).not.toBeVisible({ timeout: 5_000 });

    const banner = page.getByText('Anmeldung abschließen').first();
    await expect(banner).toBeVisible({ timeout: 5_000 });

    const closeBtn = page.getByRole('button', { name: 'Anmeldung abschließen' });
    await closeBtn.click();
    await expect(page.getByText('Anmeldung abgeschlossen')).toBeVisible({ timeout: 5_000 });
  });

  test('after creating categories, banner shows rounds configuration hint', async () => {
    await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
    await page.getByRole('button', { name: 'Auto-Kategorien' }).first().click();
    await expect(page.locator('h4.font-semibold').first()).toBeVisible({ timeout: 10_000 });

    const banner = page.getByText(/Rundenablauf konfigurieren|Sichtkontrolle durchführen/);
    await expect(banner).toBeVisible({ timeout: 5_000 });
  });

  test('after Sichtkontrolle, banner advances past categories step', async () => {
    await page.getByRole('button', { name: 'Sichtkontrolle' }).click();
    await expect(page.getByRole('heading', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('button', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 10_000 });

    const banner = page.locator('[role="status"]').filter({ hasText: 'Nächster Schritt' });
    await expect(banner).toBeVisible({ timeout: 5_000 });

    const bannerText = await banner.textContent();
    expect(bannerText).not.toContain('Sichtkontrolle');
  });

  test('categories tab shows green indicator when complete', async () => {
    const categoriesTab = page.getByRole('button', { name: 'Kategorien', exact: true });
    const greenDot = categoriesTab.locator('span.bg-green-500');

    const hasBracketHint = await page.getByText('Turnierbäume generieren').isVisible().catch(() => false);
    if (hasBracketHint) {
      await expect(greenDot).toBeVisible();
    }
  });
});
