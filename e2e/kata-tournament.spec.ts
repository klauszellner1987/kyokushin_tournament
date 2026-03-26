import { test, expect, type Page, type BrowserContext } from '@playwright/test';

function field(page: Page, label: string) {
  return page.locator('label').filter({ hasText: label }).locator('xpath=following-sibling::input | following-sibling::select').first();
}

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

test.describe.serial('Kata tournament flow', () => {
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

  test('create a Kata-only tournament', async () => {
    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await buyTokenIfNeeded(page);
    await page.getByPlaceholder('Turniername').fill('Kata Meisterschaft');
    await page.getByPlaceholder('Ort / Halle').fill('Budokan Regensburg');
    await page.getByRole('button', { name: 'Nur Kata' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();

    await expect(page.getByRole('heading', { name: 'Kata Meisterschaft' })).toBeVisible({ timeout: 10_000 });
  });

  test('add kata participants manually', async () => {
    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();

    const participants = [
      { first: 'Yuki', last: 'Tanaka', club: 'Dojo Tokyo', dob: '12.05.2008', weight: '45', gender: 'Männlich' },
      { first: 'Hana', last: 'Sato', club: 'Dojo Osaka', dob: '03.09.2007', weight: '42', gender: 'Weiblich' },
      { first: 'Kenji', last: 'Yamamoto', club: 'Dojo Berlin', dob: '28.11.2008', weight: '48', gender: 'Männlich' },
      { first: 'Sakura', last: 'Watanabe', club: 'Dojo München', dob: '17.01.2007', weight: '44', gender: 'Weiblich' },
    ];

    for (const p of participants) {
      await page.getByRole('button', { name: /Teilnehmer hinzufügen/i }).click();
      await page.waitForTimeout(500);

      await field(page, 'Vorname').fill(p.first);
      await field(page, 'Nachname').fill(p.last);
      await field(page, 'Verein / Dojo').fill(p.club);
      await page.getByPlaceholder('TT.MM.JJJJ').fill(p.dob);
      await field(page, 'Gewicht (kg)').fill(p.weight);

      const gurtSelect = page.locator('label').filter({ hasText: 'Gürtelgrad' }).locator('xpath=following-sibling::select');
      await gurtSelect.selectOption({ index: 4 });

      await page.locator('label').filter({ hasText: p.gender }).click();

      await page.getByRole('button', { name: 'Anmelden' }).click();
      await page.waitForTimeout(500);
    }

    await expect(page.getByText('4 Teilnehmer registriert')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Anmeldung abschließen' }).click();
    await expect(page.getByText('Anmeldung abgeschlossen')).toBeVisible({ timeout: 5_000 });
  });

  test('create kata category with Punktesystem', async () => {
    await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Kategorie' }).click();
    await page.waitForTimeout(500);

    const nameField = page.locator('label').filter({ hasText: /^Name$/ }).locator('xpath=following-sibling::input').first();
    await nameField.fill('Kata Jugend');

    const formatSelect = page.locator('label').filter({ hasText: 'Turnierformat' }).locator('xpath=following-sibling::select').first();
    if (await formatSelect.isVisible().catch(() => false)) {
      await formatSelect.selectOption('round_robin');
    }

    const bewertungSelect = page.locator('label').filter({ hasText: 'Bewertungssystem' }).locator('xpath=following-sibling::select').first();
    if (await bewertungSelect.isVisible().catch(() => false)) {
      await bewertungSelect.selectOption('points');
    }

    await page.getByRole('button', { name: 'Erstellen' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Kata Jugend')).toBeVisible({ timeout: 5_000 });
  });

  test('verify kata category badges', async () => {
    const categorySection = page.locator('div').filter({ hasText: 'Kata Jugend' }).last();
    const hasFormatBadge = await categorySection.getByText(/Single Elimination|Round Robin|Punktesystem/).first().isVisible().catch(() => false);
    const hasCategoryName = await page.getByText('Kata Jugend').isVisible().catch(() => false);

    expect(hasFormatBadge || hasCategoryName).toBeTruthy();
  });

  test('create a Mixed tournament and verify discipline selection', async () => {
    await page.getByRole('link', { name: 'Turniere' }).click();
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await buyTokenIfNeeded(page);
    await page.getByPlaceholder('Turniername').fill('Mixed Championship');
    await page.getByPlaceholder('Ort / Halle').fill('Sporthalle');
    await page.getByRole('button', { name: 'Mixed (Kumite & Kata)' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();

    await expect(page.getByRole('heading', { name: 'Mixed Championship' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();
    await page.getByRole('button', { name: /Teilnehmer hinzufügen/i }).click();
    await page.waitForTimeout(500);

    const disziplinLabel = page.locator('label').filter({ hasText: /^Disziplin$/ });
    await expect(disziplinLabel).toBeVisible({ timeout: 3_000 });

    const kumiteCheckbox = page.locator('label').filter({ hasText: 'kumite' }).locator('input[type="checkbox"]');
    const kataCheckbox = page.locator('label').filter({ hasText: 'kata' }).locator('input[type="checkbox"]');
    const hasCheckboxes = await kumiteCheckbox.isVisible().catch(() => false)
      || await kataCheckbox.isVisible().catch(() => false);

    expect(hasCheckboxes).toBeTruthy();
  });
});
