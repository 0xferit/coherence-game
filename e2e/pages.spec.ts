import { expect, test } from "@playwright/test";
import { ROOM_CODE, SIGNUP_LIMITS } from "../public/protocol.js";

test.use({ reducedMotion: "reduce" });

const PHONE = { width: 375, height: 740 };
const PAGES = ["/", "/deck/", "/handout/", "/join/", "/paper/", "/paper/sheets.html"];

test("session pages fit a phone and execute without page errors", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  expect(errors).toEqual([]);
});

test("deck has fourteen slides and supports keyboard changes to a real jury", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/deck/");
  await expect(page.locator("section.slide")).toHaveCount(14);
  const widget = page.locator("#w-pay");
  const dot = widget.getByRole("slider").first();
  await dot.focus();
  const before = await dot.getAttribute("aria-valuenow");
  await dot.press("ArrowRight");
  expect(await dot.getAttribute("aria-valuenow")).not.toBe(before);
  await expect(widget.locator(".v-centre")).not.toHaveText("NaN");
  await dot.scrollIntoViewIfNeeded();
  const track = await widget.locator(".track").boundingBox();
  const handle = await dot.boundingBox();
  expect(track).not.toBeNull();
  expect(handle).not.toBeNull();
  if (!track || !handle) throw new Error("the score slider has no visible geometry");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 0.8, handle.y + handle.height / 2);
  await page.mouse.up();
  await expect(dot).toHaveAttribute("aria-valuenow", "0.80");
  await page.locator("#w-bloc .bloc").fill("60");
  await expect(page.locator("#w-bloc .v-bloc")).toHaveText("60%");
  await page.locator("#w-bloc .reset").click();
  await expect(page.locator("#w-bloc .v-bloc")).toHaveText("0%");
});

test("signup validates and retains values after a network failure", async ({ page }) => {
  await page.goto("/join/");
  await page.locator("#name").fill("Ada");
  await page.locator("#email").fill("invalid");
  await page.locator("#send").click();
  await expect(page.locator("#feedback")).toContainText("does not look right");
  await page.locator("#email").fill("ada@example.org");
  await page.route("**/api/signup", (route) => route.abort());
  await page.locator("#send").click();
  await expect(page.locator("#feedback")).toContainText("Try again");
  await expect(page.locator("#name")).toHaveValue("Ada");
  await expect(page.locator("#email")).toHaveValue("ada@example.org");
  await page.unroute("**/api/signup");
  await page.route("**/api/signup", (route) => route.fulfill({ status: 201, body: "{}" }));
  await page.locator("#send").click();
  await expect(page.locator("#thanks")).toContainText("You are on the list");
});

test("paper calculator handles score boundaries, recusal and absent jurors using the ledger", async ({
  page,
}) => {
  await page.goto("/paper/");
  await expect(page.locator("#self-check")).toHaveText("Self-check passed.");
  const fields = page.locator("textarea");
  await fields.nth(0).fill("Ada 0.62");
  await fields.nth(1).fill("Ada 62\nBen recuse");
  await fields.nth(2).fill("Ada 0\nBen 100");
  await page.locator("#grade").click();
  await expect(page.locator("#results")).toContainText("Recused");
  await expect(page.locator("#results")).toContainText("Absent");
  await expect(page.locator("#results")).not.toContainText("NaN");
  const expected = await page.evaluate(() => {
    const core = (
      globalThis as unknown as {
        JuryCore: { nomineeDeltas: (...args: unknown[]) => { delta: Record<string, number> } };
      }
    ).JuryCore;
    const roster = [
      { pid: "Ada", joinedAt: 0 },
      { pid: "Ben", joinedAt: 0 },
    ];
    const rounds = [
      [{ pid: "Ada", revealed: true, score: 62 }],
      [
        { pid: "Ada", revealed: true, score: 62 },
        { pid: "Ben", recused: true },
      ],
      [
        { pid: "Ada", revealed: true, score: 0 },
        { pid: "Ben", revealed: true, score: 100 },
      ],
    ];
    const totals: Record<string, number> = { Ada: 0, Ben: 0 };
    for (const plays of rounds)
      for (const [name, net] of Object.entries(
        core.nomineeDeltas(plays, [], roster, { seated: ["Ada", "Ben"] }).delta,
      ))
        totals[name] = (totals[name] ?? 0) + net;
    return totals;
  });
  for (const [name, amount] of Object.entries(expected))
    await expect(page.locator(`#standings [data-name="${name}"] .net`)).toHaveText(
      new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(amount),
    );
  await fields.nth(0).fill("Ada 101");
  await page.locator("#grade").click();
  await expect(page.locator("#feedback")).toContainText("0 to 1 or 0 to 100");
  await expect(fields.nth(0)).toHaveValue("Ada 101");
});

test("paper sheets use the default docket and reject invalid counts", async ({ page }) => {
  await page.goto("/paper/sheets.html?jurors=30");
  await expect(page.locator(".score-sheet")).toHaveCount(30);
  await expect(page.locator(".score-sheet").first().locator("tbody tr")).toHaveCount(6);
  await page.goto("/paper/sheets.html?jurors=-1");
  await expect(page.locator("#feedback")).toContainText("between 1 and 100");
});

test("signup returns control when the service does not answer", async ({ page }) => {
  await page.goto("/join/");
  await page.clock.install();
  await page.locator("#name").fill("Ada");
  await page.locator("#email").fill("ada@example.org");
  await page.route("**/api/signup", () => {});
  await page.locator("#send").click();
  await page.clock.fastForward(15000);
  await expect(page.locator("#feedback")).toContainText("Try again");
  await expect(page.locator("#send")).toBeEnabled();
  await expect(page.locator("#email")).toHaveValue("ada@example.org");
});

test("server-side signup validation preserves the entered values", async ({ page }) => {
  await page.goto("/join/");
  await page.locator("#name").fill("Ada");
  await page.locator("#email").fill("ada@example.org");
  await page.route("**/api/signup", (route) => route.fulfill({ status: 400, body: "{}" }));
  await page.locator("#send").click();
  await expect(page.locator("#feedback")).toContainText("does not look right");
  await expect(page.locator("#name")).toHaveValue("Ada");
  await expect(page.locator("#email")).toHaveValue("ada@example.org");
});

test("paper juror names cannot collide with object prototype keys", async ({ page }) => {
  await page.goto("/paper/");
  await page.locator("textarea").first().fill("constructor 62\n__proto__ 62");
  await page.locator("#grade").click();
  await expect(page.locator("#results")).not.toContainText("NaN");
  const expected = await page.evaluate(() => {
    const core = (globalThis as unknown as { JuryCore: { ROUND_REWARD: number } }).JuryCore;
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(
      core.ROUND_REWARD / 2,
    );
  });
  for (const name of ["constructor", "__proto__"])
    await expect(page.locator(`#standings [data-name="${name}"] .net`)).toHaveText(expected);
});

test("room entry shares the server grammar and canonical lowercase route", async ({ page }) => {
  await page.goto("/");
  const input = page.locator("#room-code");
  await expect(input).toHaveAttribute("pattern", ROOM_CODE.pattern);
  for (const code of ["ab", "a_b", "a\\b"]) {
    await input.fill(code);
    await page.getByRole("button", { name: "Enter the room" }).click();
    await expect(page.locator("#feedback")).toBeVisible();
    expect(await input.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
  }
  await input.fill("Ada-9");
  expect(await input.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(true);
  await page.getByRole("button", { name: "Enter the room" }).click();
  await expect(page).toHaveURL(/\/r\/ada-9$/);
});

test("signup uses the server field limits and refuses an oversized programmatic name", async ({
  page,
}) => {
  await page.goto("/join/");
  const name = page.locator("#name");
  await expect(name).toHaveAttribute("maxlength", String(SIGNUP_LIMITS.name));
  await expect(page.locator("#email")).toHaveAttribute("maxlength", String(SIGNUP_LIMITS.email));
  await name.evaluate(
    (element: HTMLInputElement, value) => {
      element.value = value;
    },
    "a".repeat(SIGNUP_LIMITS.name + 1),
  );
  await page.locator("#email").fill("ada@example.org");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/signup")) requests.push(request.url());
  });
  await page.locator("#send").click();
  await expect(page.locator("#feedback")).toContainText(`at most ${SIGNUP_LIMITS.name}`);
  expect(requests).toEqual([]);
});
