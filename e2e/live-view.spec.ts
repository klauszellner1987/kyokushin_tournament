import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe.serial('Live view', () => {
  let page: Page;
  let context: BrowserContext;
  let tournamentId: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await page.getByPlaceholder('Turniername').fill('Live View Turnier');
    await page.getByPlaceholder('Ort / Halle').fill('Arena München');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('heading', { name: 'Live View Turnier' })).toBeVisible({ timeout: 10_000 });

    tournamentId = page.url().split('/tournament/')[1] || '';

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

    await page.getByRole('button', { name: 'Turnierbaum' }).click();
    await expect(page.getByRole('heading', { name: 'Turnierbaum' })).toBeVisible({ timeout: 5_000 });

    const categoryCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
    const count = await categoryCards.count();

    for (let i = 0; i < count; i++) {
      const card = categoryCards.nth(i);
      const text = await card.textContent() || '';
      const participantMatch = text.match(/(\d+)\s*Teilnehmer/);
      if (participantMatch && parseInt(participantMatch[1]) >= 2) {
        await card.click();
        await page.waitForTimeout(500);

        const generateBtn = page.getByRole('button', { name: 'Turnierbaum generieren' });
        if (await generateBtn.isEnabled().catch(() => false)) {
          await generateBtn.click();
          await page.waitForTimeout(2_000);
        }

        await page.getByRole('button', { name: 'Übersicht' }).click();
        await page.waitForTimeout(500);
        break;
      }
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Live tab shows live view links', async () => {
    await page.goto(`/tournament/${tournamentId}`);
    await page.waitForTimeout(1_000);
    await page.getByRole('button', { name: 'Live' }).click();

    await expect(page.getByText('Live-Ansichten')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Gesamtübersicht')).toBeVisible();
    await expect(page.getByText(/Matte \d/).first()).toBeVisible();
  });

  test('open live overview page directly', async () => {
    await page.goto(`/live/${tournamentId}`);

    await expect(page.getByText('Live View Turnier')).toBeVisible({ timeout: 10_000 });

    const matHeading = page.getByText(/Matte \d/i).first();
    await expect(matHeading).toBeVisible({ timeout: 5_000 });
  });

  test('open single mat live view', async () => {
    await page.goto(`/live/${tournamentId}/mat/1`);

    await expect(page.getByText(/MATTE 1/i).first()).toBeVisible({ timeout: 10_000 });

    const hasContent = await page.getByText('VS').isVisible().catch(() => false)
      || await page.getByText(/Warte auf/i).isVisible().catch(() => false)
      || await page.getByText(/beendet/i).isVisible().catch(() => false);

    expect(hasContent).toBeTruthy();
  });
});
