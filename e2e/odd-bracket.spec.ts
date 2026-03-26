import { test, expect, type Page, type BrowserContext } from '@playwright/test';

function field(page: Page, label: string) {
  return page.locator('label').filter({ hasText: label }).locator('xpath=following-sibling::input | following-sibling::select').first();
}

interface Fighter {
  first: string;
  last: string;
  weight: string;
}

async function addFighter(page: Page, f: Fighter) {
  await page.getByRole('button', { name: /Teilnehmer hinzufügen/i }).click();
  await page.waitForTimeout(500);
  await field(page, 'Vorname').fill(f.first);
  await field(page, 'Nachname').fill(f.last);
  await field(page, 'Verein / Dojo').fill('Test Dojo');
  await page.getByPlaceholder('TT.MM.JJJJ').fill('10.03.1995');
  await field(page, 'Gewicht (kg)').fill(f.weight);
  const gurtSelect = page.locator('label').filter({ hasText: 'Gürtelgrad' }).locator('xpath=following-sibling::select');
  await gurtSelect.selectOption({ index: 5 });
  await page.locator('label').filter({ hasText: 'Männlich' }).click();
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await page.waitForTimeout(500);
}

async function completeCurrentMatch(page: Page) {
  // Multiple mats may show "Kampf starten" simultaneously — always target the first
  const startBtn = page.getByRole('button', { name: 'Kampf starten' }).first();
  await expect(startBtn).toBeVisible({ timeout: 10_000 });
  await startBtn.click();

  // Wait for 5s timer + buffer
  await page.waitForTimeout(7_000);

  // Decision modal appears → open result (use .first() in case both mats have modals)
  await expect(page.getByText('Ergebnis eintragen').first()).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: 'Ergebnis eintragen' }).first().click();
  await page.waitForTimeout(500);

  // Enter 1:0 result (target the first visible score input)
  const scoreInputs = page.locator('input[type="number"]');
  await scoreInputs.first().fill('1');

  // Confirm
  const confirmBtn = page.getByRole('button', { name: 'Bestätigen' }).first();
  await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
  await confirmBtn.click();
  await page.waitForTimeout(1_500);
}

// ============================================================
// Test: 5 fighters (odd, non-power-of-2) — the original bug case
// Bracket size 8: 1 real match + 3 byes in R1, then 2 semis + 1 final
// ============================================================
test.describe.serial('Odd bracket: 5 fighters complete tournament', () => {
  let page: Page;
  let context: BrowserContext;

  const fighters: Fighter[] = [
    { first: 'Akira', last: 'Tanaka', weight: '75' },
    { first: 'Hiro', last: 'Sato', weight: '76' },
    { first: 'Yuki', last: 'Ito', weight: '77' },
    { first: 'Kenta', last: 'Suzuki', weight: '78' },
    { first: 'Daiki', last: 'Nakamura', weight: '79' },
  ];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });

    // Create tournament
    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await page.getByPlaceholder('Turniername').fill('5er Bracket Test');
    await page.getByPlaceholder('Ort / Halle').fill('Testhalle');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('heading', { name: '5er Bracket Test' })).toBeVisible({ timeout: 10_000 });

    // Add 5 fighters
    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();
    for (const f of fighters) {
      await addFighter(page, f);
    }
    await expect(page.getByText('5 Teilnehmer registriert')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Anmeldung abschließen' }).click();
    await expect(page.getByText('Anmeldung abgeschlossen')).toBeVisible({ timeout: 5_000 });

    // Create kumite category with short fight duration
    await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Kategorie' }).click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder="z.B. Kumite Herren -75kg"]');
    await nameInput.fill('5er Kumite');

    const durationInputs = page.locator('input[placeholder="z.B. 120"]');
    await durationInputs.nth(0).fill('5');  // R1
    await durationInputs.nth(1).fill('5');  // R2

    await page.getByRole('button', { name: 'Erstellen' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: '5er Kumite' })).toBeVisible({ timeout: 5_000 });

    // Sichtkontrolle
    await page.getByRole('button', { name: 'Sichtkontrolle' }).click();
    await expect(page.getByRole('heading', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('button', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 10_000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('bracket generates successfully with 5 fighters', async () => {
    await page.getByRole('button', { name: 'Turnierbaum', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Turnierbaum' })).toBeVisible({ timeout: 5_000 });

    // Click on our category
    const categoryCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
    const count = await categoryCards.count();
    for (let i = 0; i < count; i++) {
      const card = categoryCards.nth(i);
      const text = await card.textContent() || '';
      if (text.includes('5er Kumite')) {
        await card.click();
        break;
      }
    }

    await page.waitForTimeout(500);
    const generateBtn = page.getByRole('button', { name: 'Turnierbaum generieren' }).first();
    await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
    await generateBtn.click();
    await page.waitForTimeout(2_000);

    // Bracket should be visible with Champion box
    await expect(page.getByText('Champion')).toBeVisible({ timeout: 5_000 });
  });

  test('bracket shows BYE labels (3 byes expected for 5 fighters)', async () => {
    // 5 fighters in bracket of 8 → 3 bye matches
    const byeLabels = page.getByText('BYE');
    const byeCount = await byeLabels.count();
    expect(byeCount).toBeGreaterThanOrEqual(3);
  });

  test('bracket has correct round structure', async () => {
    // 8-bracket → 3 rounds: Viertelfinale, Halbfinale, Finale
    await expect(page.getByText('Viertelfinale', { exact: true })).toBeVisible();
    await expect(page.getByText('Halbfinale', { exact: true })).toBeVisible();
    await expect(page.getByText('Finale', { exact: true })).toBeVisible();
  });

  test('no double-bye matches (no match with both slots empty)', async () => {
    // The key bug: with 5 fighters, there used to be null-vs-null matches.
    // After the fix, every match should have at least one fighter or be a proper bye.
    // Verify there are no match cards showing "Noch offen" vs "Noch offen".
    const matchCards = page.locator('[class*="border"][class*="rounded"]').filter({ hasText: 'vs' });
    const count = await matchCards.count();

    for (let i = 0; i < count; i++) {
      const card = matchCards.nth(i);
      const text = await card.textContent() || '';
      const openSlots = (text.match(/Noch offen/g) || []).length;
      // A match may have one "Noch offen" (waiting for feeder), but never two
      expect(openSlots).toBeLessThanOrEqual(1);
    }
  });

  test('play all matches via Kampfleitung until champion', async () => {
    await page.getByRole('button', { name: 'Kampfleitung', exact: true }).click();
    await page.waitForTimeout(1_000);

    // 5 fighters: 1 R1 real match + 2 semis + 1 final = 4 real matches
    // Matches are distributed across 2 mats, so fight them one by one
    const maxMatches = 6; // safety limit
    for (let i = 0; i < maxMatches; i++) {
      // Check if all fights are done
      const allDone = await page.getByText(/Alle Kämpfe beendet/).first()
        .isVisible({ timeout: 2_000 }).catch(() => false);
      if (allDone) break;

      const hasMatch = await page.getByRole('button', { name: 'Kampf starten' }).first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      if (!hasMatch) break;

      await completeCurrentMatch(page);
    }

    // All fights should be done
    await expect(page.getByText(/Alle Kämpfe beendet/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('champion is determined in bracket', async () => {
    await page.getByRole('button', { name: 'Turnierbaum', exact: true }).click();
    await page.waitForTimeout(1_000);

    // Click on the category
    const categoryCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
    const count = await categoryCards.count();
    for (let i = 0; i < count; i++) {
      const card = categoryCards.nth(i);
      const text = await card.textContent() || '';
      if (text.includes('5er Kumite')) {
        await card.click();
        break;
      }
    }

    await page.waitForTimeout(1_000);

    // All matches should be completed — verify no "pending" matches remain
    await expect(page.getByText('Champion')).toBeVisible({ timeout: 5_000 });
    // The final match should have a winner (gold-highlighted fighter)
    const goldWinners = page.locator('[class*="kyokushin-gold"]');
    const winnerCount = await goldWinners.count();
    expect(winnerCount).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// Test: 3 fighters — smallest odd bracket
// Bracket size 4: 1 real match + 1 bye in R1, then 1 final
// ============================================================
test.describe.serial('Odd bracket: 3 fighters complete tournament', () => {
  let page: Page;
  let context: BrowserContext;

  const fighters: Fighter[] = [
    { first: 'Taro', last: 'Kimura', weight: '70' },
    { first: 'Jiro', last: 'Watanabe', weight: '71' },
    { first: 'Saburo', last: 'Hayashi', weight: '72' },
  ];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Turniere', exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Neues Turnier' }).click();
    await page.getByPlaceholder('Turniername').fill('3er Bracket Test');
    await page.getByPlaceholder('Ort / Halle').fill('Testhalle');
    await page.getByRole('button', { name: 'Nur Kumite' }).click();
    await page.getByRole('button', { name: 'Erstellen' }).click();
    await expect(page.getByRole('heading', { name: '3er Bracket Test' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Teilnehmer', exact: true }).click();
    for (const f of fighters) {
      await addFighter(page, f);
    }
    await expect(page.getByText('3 Teilnehmer registriert')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Anmeldung abschließen' }).click();
    await expect(page.getByText('Anmeldung abgeschlossen')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
    await page.getByRole('button', { name: 'Neue Kategorie' }).click();
    await page.waitForTimeout(500);

    const nameInput = page.locator('input[placeholder="z.B. Kumite Herren -75kg"]');
    await nameInput.fill('3er Kumite');

    const durationInputs = page.locator('input[placeholder="z.B. 120"]');
    await durationInputs.nth(0).fill('5');
    await durationInputs.nth(1).fill('5');

    await page.getByRole('button', { name: 'Erstellen' }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Sichtkontrolle' }).click();
    await expect(page.getByRole('heading', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByRole('button', { name: 'Sichtkontrolle' })).toBeVisible({ timeout: 10_000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('bracket generates with 3 fighters and shows BYE', async () => {
    await page.getByRole('button', { name: 'Turnierbaum', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Turnierbaum' })).toBeVisible({ timeout: 5_000 });

    const categoryCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
    const count = await categoryCards.count();
    for (let i = 0; i < count; i++) {
      const card = categoryCards.nth(i);
      const text = await card.textContent() || '';
      if (text.includes('3er Kumite')) {
        await card.click();
        break;
      }
    }

    await page.waitForTimeout(500);
    const generateBtn = page.getByRole('button', { name: 'Turnierbaum generieren' }).first();
    await expect(generateBtn).toBeEnabled({ timeout: 5_000 });
    await generateBtn.click();
    await page.waitForTimeout(2_000);

    await expect(page.getByText('Champion')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Halbfinale', { exact: true })).toBeVisible();
    await expect(page.getByText('Finale', { exact: true })).toBeVisible();

    // 3 fighters in bracket of 4 → 1 bye
    const byeLabels = page.getByText('BYE');
    const byeCount = await byeLabels.count();
    expect(byeCount).toBeGreaterThanOrEqual(1);
  });

  test('play all matches (2 total) to determine champion', async () => {
    await page.getByRole('button', { name: 'Kampfleitung', exact: true }).click();
    await page.waitForTimeout(1_000);

    // 3 fighters: 1 real R1 match + 1 final = 2 total matches
    const maxMatches = 4;
    for (let i = 0; i < maxMatches; i++) {
      const allDone = await page.getByText(/Alle Kämpfe beendet/).first()
        .isVisible({ timeout: 2_000 }).catch(() => false);
      if (allDone) break;

      const hasMatch = await page.getByRole('button', { name: 'Kampf starten' }).first()
        .isVisible({ timeout: 10_000 }).catch(() => false);
      if (!hasMatch) break;

      await completeCurrentMatch(page);
    }

    await expect(page.getByText(/Alle Kämpfe beendet/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('champion is determined', async () => {
    await page.getByRole('button', { name: 'Turnierbaum', exact: true }).click();
    await page.waitForTimeout(1_000);

    const categoryCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
    const count = await categoryCards.count();
    for (let i = 0; i < count; i++) {
      const card = categoryCards.nth(i);
      const text = await card.textContent() || '';
      if (text.includes('3er Kumite')) {
        await card.click();
        break;
      }
    }

    await page.waitForTimeout(1_000);
    await expect(page.getByText('Champion')).toBeVisible({ timeout: 5_000 });
    const goldWinners = page.locator('[class*="kyokushin-gold"]');
    const winnerCount = await goldWinners.count();
    expect(winnerCount).toBeGreaterThanOrEqual(1);
  });
});
