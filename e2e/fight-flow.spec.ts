import { test, expect, type Page, type BrowserContext } from '@playwright/test';

function field(page: Page, label: string) {
  return page.locator('label').filter({ hasText: label }).locator('xpath=following-sibling::input | following-sibling::select').first();
}

async function createTournamentWithFighters(
  page: Page,
  tournamentName: string,
  fighter1Weight: string,
  fighter2Weight: string,
) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Neues Turnier' }).click();
  await page.getByPlaceholder('Turniername').fill(tournamentName);
  await page.getByPlaceholder('Ort / Halle').fill('Testhalle');
  await page.getByRole('button', { name: 'Nur Kumite' }).click();
  await page.getByRole('button', { name: 'Erstellen' }).click();
  await expect(page.getByRole('heading', { name: tournamentName })).toBeVisible({ timeout: 10_000 });

  // Add fighters
  await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();

  for (const { first, last, weight } of [
    { first: 'Kenji', last: 'Takahashi', weight: fighter1Weight },
    { first: 'Ryu', last: 'Yamamoto', weight: fighter2Weight },
  ]) {
    await page.getByRole('button', { name: /Teilnehmer hinzufügen/i }).click();
    await page.waitForTimeout(500);
    await field(page, 'Vorname').fill(first);
    await field(page, 'Nachname').fill(last);
    await field(page, 'Verein / Dojo').fill('Test Dojo');
    await page.getByPlaceholder('TT.MM.JJJJ').fill('10.03.1995');
    await field(page, 'Gewicht (kg)').fill(weight);
    const gurtSelect = page.locator('label').filter({ hasText: 'Gürtelgrad' }).locator('xpath=following-sibling::select');
    await gurtSelect.selectOption({ index: 5 });
    await page.locator('label').filter({ hasText: 'Männlich' }).click();
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await page.waitForTimeout(500);
  }

  await expect(page.getByText('2 Teilnehmer registriert')).toBeVisible({ timeout: 5_000 });
}

async function createCategoryWithFullFlow(page: Page, categoryName: string) {
  await page.getByRole('button', { name: 'Kategorien' }).click();
  await page.getByRole('button', { name: 'Neue Kategorie' }).click();
  await page.waitForTimeout(500);

  const nameInput = page.locator('input[placeholder="z.B. Kumite Herren -75kg"]');
  await nameInput.fill(categoryName);

  // All duration inputs share the same placeholder
  const durationInputs = page.locator('input[placeholder="z.B. 120"]');

  // R1: 5 seconds (short for testing)
  await durationInputs.nth(0).fill('5');
  // R2: 5 seconds
  await durationInputs.nth(1).fill('5');

  // Enable Gewichtsentscheid
  const weightCheckbox = page.locator('label').filter({ hasText: 'Gewichtsentscheid' }).locator('input[type="checkbox"]');
  await weightCheckbox.check();
  await page.waitForTimeout(300);

  // R3 Pflichtentscheid: 5 seconds
  await durationInputs.nth(2).fill('5');

  await page.getByRole('button', { name: 'Erstellen' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: categoryName })).toBeVisible({ timeout: 5_000 });
}

async function confirmAndGenerateBracket(page: Page, categoryName: string) {
  // Sichtkontrolle
  await page.getByRole('button', { name: 'Sichtkontrolle' }).click();
  await expect(page.getByRole('heading', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByRole('button', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 10_000 });

  // Generate bracket
  await page.getByRole('button', { name: 'Turnierbaum' }).click();
  await expect(page.getByRole('heading', { name: 'Turnierbaum' })).toBeVisible({ timeout: 5_000 });

  // Click on the target category
  const categoryCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
  const count = await categoryCards.count();
  for (let i = 0; i < count; i++) {
    const card = categoryCards.nth(i);
    const text = await card.textContent() || '';
    if (text.includes(categoryName)) {
      await card.click();
      break;
    }
  }

  await page.waitForTimeout(1_000);

  // Generate bracket
  const generateBtn = page.getByRole('button', { name: 'Turnierbaum generieren' }).first();
  await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
  await generateBtn.click();
  await page.waitForTimeout(2_000);

  // Verify bracket was generated — Champion box should appear
  await expect(page.getByText('Champion')).toBeVisible({ timeout: 5_000 });
}

async function navigateToFightControl(page: Page) {
  await page.getByRole('button', { name: 'Kampfleitung' }).click();
  await page.waitForTimeout(1_000);
}

async function fightRoundWithDraw(page: Page) {
  await page.getByRole('button', { name: 'Kampf starten' }).click();
  // Wait for the 5-second timer to expire + buffer
  await page.waitForTimeout(7_000);
  // Decision modal should appear
  await expect(page.getByText('Ergebnis eintragen').first()).toBeVisible({ timeout: 5_000 });
}

// ============================================================
// Test Suite 1: Gewichtsentscheid resolves the fight
// (weight diff >= threshold → lighter fighter wins)
// ============================================================
test.describe.serial('Fight flow: Gewichtsentscheid wins (diff >= threshold)', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // 75kg vs 80kg → 5kg diff, above 3kg threshold
    await createTournamentWithFighters(page, 'Gewichtsentscheid Test', '75', '80');
    await createCategoryWithFullFlow(page, 'GE Test Kategorie');
    await confirmAndGenerateBracket(page, 'GE Test Kategorie');
    await navigateToFightControl(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Kampfleitung shows the match with both fighters', async () => {
    await expect(page.getByText('TAKAHASHI')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('YAMAMOTO')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kampf starten' })).toBeVisible();
  });

  test('R1: fight ends in draw, R2 option appears', async () => {
    await fightRoundWithDraw(page);

    // Open result entry
    await page.getByRole('button', { name: 'Ergebnis eintragen' }).click();
    await page.waitForTimeout(500);

    // Draw (0:0) → "Runde 2 starten" button
    const r2Button = page.getByRole('button', { name: /Runde 2 starten/i });
    await expect(r2Button).toBeVisible({ timeout: 3_000 });
    await r2Button.click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Runde 2 (Verlängerung)', { exact: true })).toBeVisible({ timeout: 3_000 });
  });

  test('R2: fight ends in draw, Gewichtsentscheid option appears', async () => {
    await fightRoundWithDraw(page);

    // From decision modal: Gewichtsentscheid button should appear
    const gewichtButton = page.getByRole('button', { name: /Gewichtsentscheid/i }).first();
    await expect(gewichtButton).toBeVisible({ timeout: 3_000 });

    // No "Runde 4" option should exist anymore
    await expect(page.getByRole('button', { name: /Runde 4/i })).not.toBeVisible();

    await gewichtButton.click();
    await page.waitForTimeout(500);
  });

  test('Gewichtsentscheid: weight comparison shown, lighter fighter can win', async () => {
    await expect(page.getByRole('heading', { name: 'Gewichtsentscheid', exact: true })).toBeVisible({ timeout: 3_000 });

    // Should show both weights
    await expect(page.getByText('75 kg').first()).toBeVisible();
    await expect(page.getByText('80 kg').first()).toBeVisible();

    // Diff is 5.0 kg, above 3kg threshold
    await expect(page.getByText('5.0 kg', { exact: true })).toBeVisible();

    // Lighter fighter wins button
    const winnerButton = page.getByRole('button', { name: /gewinnt.*leichter/i });
    await expect(winnerButton).toBeVisible({ timeout: 3_000 });

    await winnerButton.click();
    await page.waitForTimeout(1_000);

    // Match completed
    const completedText = page.getByText(/Alle Kämpfe beendet|Warte auf nächsten/);
    await expect(completedText).toBeVisible({ timeout: 5_000 });
  });
});

// ============================================================
// Test Suite 2: Pflichtentscheid (R3) when Gewichtsentscheid fails
// (weight diff < threshold → must go to R3 for forced 1:0)
// ============================================================
test.describe.serial('Fight flow: R3 Pflichtentscheid (diff < threshold)', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // 76kg vs 77kg → 1kg diff, below 3kg threshold
    await createTournamentWithFighters(page, 'Pflichtentscheid Test', '76', '77');
    await createCategoryWithFullFlow(page, 'PE Test Kategorie');
    await confirmAndGenerateBracket(page, 'PE Test Kategorie');
    await navigateToFightControl(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('R1: fight draw → advance to R2', async () => {
    await expect(page.getByRole('button', { name: 'Kampf starten' })).toBeVisible({ timeout: 5_000 });
    await fightRoundWithDraw(page);

    await page.getByRole('button', { name: 'Ergebnis eintragen' }).click();
    await page.waitForTimeout(500);

    const r2Button = page.getByRole('button', { name: /Runde 2 starten/i });
    await expect(r2Button).toBeVisible({ timeout: 3_000 });
    await r2Button.click();
    await page.waitForTimeout(500);
  });

  test('R2: fight draw → Gewichtsentscheid', async () => {
    await expect(page.getByText('Runde 2 (Verlängerung)', { exact: true })).toBeVisible({ timeout: 3_000 });
    await fightRoundWithDraw(page);

    const gewichtButton = page.getByRole('button', { name: /Gewichtsentscheid/i }).first();
    await expect(gewichtButton).toBeVisible({ timeout: 3_000 });
    await gewichtButton.click();
    await page.waitForTimeout(500);
  });

  test('Gewichtsentscheid: diff below threshold → R3 Pflichtentscheid available', async () => {
    await expect(page.getByRole('heading', { name: 'Gewichtsentscheid', exact: true })).toBeVisible({ timeout: 3_000 });

    // Weight diff is 1.0 kg < 3kg threshold
    await expect(page.getByText('1.0 kg', { exact: true })).toBeVisible();
    await expect(page.getByText(/kein Gewichtsentscheid möglich/)).toBeVisible();

    // R3 Pflichtentscheid button must be available
    const r3Button = page.getByRole('button', { name: /Runde 3 starten.*Pflichtentscheid/i });
    await expect(r3Button).toBeVisible({ timeout: 3_000 });

    // No "Runde 4" anywhere
    await expect(page.getByText(/Runde 4/)).not.toBeVisible();

    await r3Button.click();
    await page.waitForTimeout(500);
  });

  test('R3: Pflichtentscheid round label shown', async () => {
    await expect(page.getByText('Runde 3 (Pflichtentscheid)', { exact: true })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Kampf starten' })).toBeVisible();
  });

  test('R3: fight ends → must pick winner with 1:0 (Pflichtentscheid)', async () => {
    await fightRoundWithDraw(page);

    // Open result entry
    await page.getByRole('button', { name: 'Ergebnis eintragen' }).click();
    await page.waitForTimeout(500);

    // In R3, draw → forced decision (Pflichtentscheid text + pick winner)
    await expect(page.getByText('Pflichtentscheid').first()).toBeVisible({ timeout: 3_000 });

    // Two fighter buttons to force a 1:0 decision
    const buttons = page.locator('button').filter({ hasText: /Takahashi|Yamamoto/i });
    const buttonCount = await buttons.count();
    expect(buttonCount).toBe(2);

    // There must NOT be any further round option
    await expect(page.getByRole('button', { name: /Runde 4/i })).not.toBeVisible();

    // Pick first fighter → sets score to 1:0
    await buttons.first().click();
    await page.waitForTimeout(500);
  });

  test('match completes after Pflichtentscheid decision', async () => {
    // Confirm the 1:0 result if needed
    const confirmBtn = page.getByRole('button', { name: 'Bestätigen' });
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(1_000);
    }

    const completedText = page.getByText(/Alle Kämpfe beendet|Warte auf nächsten/);
    await expect(completedText).toBeVisible({ timeout: 5_000 });
  });
});
