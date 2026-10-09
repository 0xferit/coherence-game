import { type BrowserContext, expect, type Page, test } from "@playwright/test";

const JURORS = 30;
const NOMINEES = 6;
const HOST = 0;
const LEAK_REPORTER = 1;
const LEAK_VICTIM = 2;
const SECOND_REPORTER = 4;
const SCRIPTED_JUROR = 3;
const RECUSER = 5;
const RECUSE_NOMINEE = 2;
const RESEALER = 7;
const RESEAL_SCORE = 60;
const SLEEPER = 9;
const SLEEP_NOMINEE = 3;
const TWO_TAB_JUROR = 11;
const BLOC_NOMINEE = 4;
const NEW_HOST = 2;
const TAKEOVER_NOMINEE = 1;
const SCRIPTED_NAME = "<b>Mallory</b>";
const SCORE_CENTRE = 50;
const SCORE_SPREAD = 20;
const STEP = 15_000;
const WAKE = 30_000;

function nameOf(i: number): string {
  return i === SCRIPTED_JUROR ? SCRIPTED_NAME : `Juror ${i}`;
}

function scoreFor(juror: number, nominee: number): number {
  return SCORE_CENTRE + (((juror * 7 + nominee * 13) % (2 * SCORE_SPREAD + 1)) - SCORE_SPREAD);
}

async function setScore(page: Page, score: number): Promise<void> {
  await page.locator("#rng").evaluate((el, value) => {
    const input = el as HTMLInputElement;
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, score);
}

async function seal(page: Page, score: number): Promise<void> {
  await setScore(page, score);
  await page.locator("#seal").click();
  await expect(page.locator("#chg")).toBeVisible({ timeout: STEP });
}

test("thirty jurors play six nominees and agree on every number", async ({ browser }) => {
  const room = `e2e-${Date.now().toString(36)}`;
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (let i = 0; i < JURORS; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`/r/${room}`);
      contexts.push(context);
      pages.push(page);
    }
    let host = pages[HOST] as Page;
    await host.locator("#nm").fill(nameOf(HOST));
    await host.locator("#summon").click();
    await expect(host.locator("#open")).toBeVisible({ timeout: STEP });

    for (let i = 1; i < JURORS; i++) {
      const page = pages[i] as Page;
      await expect(page.locator("#seat")).toBeVisible({ timeout: STEP });
      await page.locator("#nm").fill(nameOf(i));
      await page.locator("#seat").click();
    }
    await expect(host.locator(".chip")).toHaveCount(JURORS, { timeout: STEP });
    const twin = await (contexts[TWO_TAB_JUROR] as BrowserContext).newPage();
    await twin.goto(`/r/${room}`);

    for (let nominee = 0; nominee < NOMINEES; nominee++) {
      await host.locator("#open").click();
      await expect(host.locator("#seal")).toBeVisible({ timeout: STEP });
      for (let i = 0; i < JURORS; i++) {
        const page = pages[i] as Page;
        if (i === RECUSER && nominee === RECUSE_NOMINEE) {
          await page.locator("#rec").click();
          await expect(page.locator("#unrec")).toBeVisible({ timeout: STEP });
          continue;
        }
        await seal(page, scoreFor(i, nominee));
      }
      if (nominee === 0) {
        const resealer = pages[RESEALER] as Page;
        await resealer.locator("#chg").click();
        await seal(resealer, RESEAL_SCORE);
        await expect(twin.locator("#chg")).toBeVisible({ timeout: STEP });
        const proof = (
          (await (pages[LEAK_VICTIM] as Page).locator(".proof").textContent()) ?? ""
        ).trim();
        expect(proof.length).toBeGreaterThan(0);
        const reporter = pages[LEAK_REPORTER] as Page;
        await reporter.locator("#rep").fill(proof);
        await reporter.locator("#repBtn").click();
        await expect(
          reporter.locator(".banner.good").filter({ hasText: "Reported" }),
        ).toContainText("Reported", { timeout: STEP });
        const second = pages[SECOND_REPORTER] as Page;
        await second.locator("#rep").fill(proof);
        await second.locator("#repBtn").click();
        await expect(
          second.locator(".banner.amber").filter({ hasText: "already reported" }),
        ).toContainText("already reported", {
          timeout: STEP,
        });
      }
      if (nominee === SLEEP_NOMINEE) await (contexts[SLEEPER] as BrowserContext).setOffline(true);

      await expect(host.locator("#toReveal")).toBeEnabled({ timeout: STEP });
      await host.locator("#toReveal").click();
      await expect(host.locator("#toRes")).toBeVisible({ timeout: STEP });
      if (nominee === SLEEP_NOMINEE) {
        await expect(host.locator(".unrevealed")).toHaveText(
          `Not yet revealed: ${nameOf(SLEEPER)}`,
          { timeout: STEP },
        );
      } else {
        await expect(host.getByText("Everyone has revealed.")).toBeVisible({ timeout: STEP });
      }
      if (nominee === TAKEOVER_NOMINEE) {
        const previousHost = host;
        host = pages[NEW_HOST] as Page;
        await host.locator("#takeover").click();
        await host.locator("#cTake").click();
        await expect(host.locator("#toRes")).toBeVisible({ timeout: STEP });
        await expect(previousHost.locator("#toRes")).toHaveCount(0, { timeout: STEP });
      }
      await host.locator("#toRes").click();
      await expect(host.locator(".verdict")).toBeVisible({ timeout: STEP });

      if (nominee === SLEEP_NOMINEE) {
        await (contexts[SLEEPER] as BrowserContext).setOffline(false);
        await expect((pages[SLEEPER] as Page).locator(".verdict")).toContainText("no reveal", {
          timeout: WAKE,
        });
        await expect(host.getByText("did not reveal in time")).toContainText(nameOf(SLEEPER));
      }
      if (nominee === RECUSE_NOMINEE) {
        await expect(host.getByText("recused: no stake")).toContainText(nameOf(RECUSER));
      }
      if (nominee === BLOC_NOMINEE) {
        await expect(host.locator(".banner").filter({ hasText: "Bloc assigned" })).toBeVisible();
      }
      const reference = await host.locator(".standings").innerText();
      expect(reference).toContain(SCRIPTED_NAME);
      for (let i = 0; i < JURORS; i++) {
        await expect((pages[i] as Page).locator(".standings")).toHaveText(reference, {
          timeout: STEP,
          useInnerText: true,
        });
      }
      await host.locator("#next").click();
    }

    await expect(host.locator(".board")).toBeVisible({ timeout: STEP });
    const board = await host.locator(".board").innerText();
    expect(board).toContain(SCRIPTED_NAME);
    for (let i = 0; i < JURORS; i++) {
      await expect((pages[i] as Page).locator(".board")).toHaveText(board, {
        timeout: STEP,
        useInnerText: true,
      });
    }

    const newHost = pages[HOST] as Page;
    await newHost.locator("#takeover").click();
    await newHost.locator("#cTake").click();
    await expect(newHost.locator("#bNew")).toBeVisible({ timeout: STEP });
    await newHost.locator("#bNew").click();
    await newHost.locator("#cNew").click();
    await expect(host.locator("#summon")).toBeVisible({ timeout: STEP });
    await expect(twin.locator("#summon")).toBeVisible({ timeout: STEP });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
