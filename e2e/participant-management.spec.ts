import { test, expect, type Page, type BrowserContext } from '@playwright/test';

function field(page: Page, label: string) {
  return page.locator('label').filter({ hasText: label }).locator('xpath=following-sibling::input | following-sibling::select').first();
}

test.describe.serial('Participant manual management', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await page.getByPlaceholder('Turniername').fill('Teilnehmer-Test Turnier');
    await page.getByPlaceholder('Ort / Halle').fill('Testhalle');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('heading', { name: 'Teilnehmer-Test Turnier' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('add a participant manually', async () => {
    await page.getByRole('button', { name: /Teilnehmer hinzufügen/i }).click();
    await page.waitForTimeout(500);

    await field(page, 'Vorname').fill('Klaus');
    await field(page, 'Nachname').fill('Zellner');
    await field(page, 'Verein / Dojo').fill('Dojo Regensburg');
    await page.getByPlaceholder('TT.MM.JJJJ').fill('15.06.1987');
    await field(page, 'Gewicht (kg)').fill('80');

    const gurtSelect = page.locator('label').filter({ hasText: 'Gürtelgrad' }).locator('xpath=following-sibling::select');
    await gurtSelect.selectOption({ index: 3 });

    await page.locator('label').filter({ hasText: 'Männlich' }).click();

    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page.getByText('1 Teilnehmer registriert')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Zellner, Klaus')).toBeVisible();
  });

  test('add a second participant', async () => {
    await page.getByRole('button', { name: /Teilnehmer hinzufügen/i }).click();
    await page.waitForTimeout(500);

    await field(page, 'Vorname').fill('Maria');
    await field(page, 'Nachname').fill('Huber');
    await field(page, 'Verein / Dojo').fill('Dojo München');
    await page.getByPlaceholder('TT.MM.JJJJ').fill('22.03.1995');
    await field(page, 'Gewicht (kg)').fill('58');

    const gurtSelect = page.locator('label').filter({ hasText: 'Gürtelgrad' }).locator('xpath=following-sibling::select');
    await gurtSelect.selectOption({ index: 5 });

    await page.locator('label').filter({ hasText: 'Weiblich' }).click();

    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(page.getByText('2 Teilnehmer registriert')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Huber, Maria')).toBeVisible();
  });

  test('edit an existing participant', async () => {
    const row = page.locator('tr', { hasText: 'Zellner, Klaus' });
    await row.getByRole('button').filter({ has: page.locator('svg') }).first().click();

    await expect(page.getByText('Teilnehmer bearbeiten')).toBeVisible({ timeout: 3_000 });

    const weightField = field(page, 'Gewicht (kg)');
    await weightField.clear();
    await weightField.fill('85');

    await page.getByRole('button', { name: 'Speichern' }).click();

    await expect(page.getByText('85')).toBeVisible({ timeout: 5_000 });
  });

  test('search filters participants', async () => {
    const search = page.getByPlaceholder('Suche...');
    await search.fill('Huber');

    await expect(page.getByText('Huber, Maria')).toBeVisible();
    await expect(page.getByText('Zellner, Klaus')).not.toBeVisible();

    await search.clear();
    await expect(page.getByText('Zellner, Klaus')).toBeVisible();
    await expect(page.getByText('Huber, Maria')).toBeVisible();
  });

  test('delete a participant', async () => {
    const row = page.locator('tr', { hasText: 'Huber, Maria' });
    const deleteBtn = row.locator('button').last();
    await deleteBtn.click();

    await expect(page.getByRole('heading', { name: 'Teilnehmer löschen' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Löschen' }).click();

    await expect(page.getByText('1 Teilnehmer registriert')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Huber, Maria')).not.toBeVisible();
  });
});
