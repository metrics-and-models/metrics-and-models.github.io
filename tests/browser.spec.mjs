import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { loadContent } from "../lib/content.mjs";

const content = loadContent();
const people = JSON.parse(fs.readFileSync("site/_data/people.json", "utf8"));

test("responsive pages have no overflow, broken assets or browser errors", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(response.url());
  });
  const pages = [
    "",
    "people/",
    "about/",
    "details/previous_talks.html",
    "details/internal_lab_sessions.html",
    ...content.details.map((t) => t.url.slice(1)),
  ];
  for (const url of pages) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("h1")).toBeVisible();
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      outside: [
        ...document.querySelectorAll(
          "main h1, main h2, main h3, main p, main a, main button",
        ),
      ]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width && (box.right > innerWidth + 1 || box.left < -1);
        })
        .map((el) => el.textContent.slice(0, 80)),
    }));
    expect(overflow.scroll, url).toBeLessThanOrEqual(overflow.width);
    expect(overflow.outside, url).toEqual([]);
    for (const img of await page.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0), {
          message: url,
        })
        .toBeTruthy();
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    if (["", "people/", "details/emilycantrell.html"].includes(url))
      await page.screenshot({
        path: testInfo.outputPath(
          (url || "home").replaceAll("/", "-") + ".png",
        ),
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});

test("archive search, year filtering and empty state work together", async ({
  page,
}) => {
  await page.goto("details/previous_talks.html");
  const rows = page.locator(".talk-row:visible");
  await expect(rows).toHaveCount(content.archive.length);
  await page.getByRole("searchbox").fill("Iain");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Hrynaszkiewicz");
  await page.getByRole("combobox").selectOption("2025");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("No talks found.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(rows).toHaveCount(content.archive.length);
  await page.getByRole("combobox").selectOption("2025");
  await expect(rows).toHaveCount(
    content.archive.filter((t) => t.date.year === "2025").length,
  );
  await page.getByRole("combobox").selectOption("");
  await page.getByRole("searchbox").fill("google deepmind");
  await expect(rows.filter({ hasText: "Jacob Walker" })).toHaveCount(1);
  for (const row of await rows.all())
    await expect(row).toContainText(/Google DeepMind/i);
});

test("navigation is keyboard accessible on mobile and desktop", async ({
  page,
}) => {
  await page.goto("");
  const menu = page.locator(".menu-toggle");
  if (await menu.isVisible()) {
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
  }
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /People/ })
    .click();
  await expect(page.locator("h1")).toHaveText("People");
  await expect(page.locator(".person")).toHaveCount(people.length);
  await expect(page.locator(".person-role")).toHaveText(
    people.map(() => "Lab member"),
  );
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Seminars", exact: true })
    .click();
  await expect(page.locator("#upcoming")).toBeInViewport();
  await expect(page.locator("#upcoming h2")).toHaveText("Open seminars");
});

test("seminar details, registration and calendar downloads are connected", async ({
  page,
}) => {
  await page.goto("");
  await page.locator(".talk-row h3 a").first().click();
  await expect(page.locator("h1")).toHaveText(content.next.title);
  await expect(page.locator(".talk-copy")).toContainText("Abstract");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Add to calendar" }).click();
  expect((await download).suggestedFilename()).toContain(".ics");
  await page.getByRole("link", { name: "Attend this talk" }).click();
  await expect(page.locator("#join")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Registration form" }),
  ).toHaveAttribute("href", "https://forms.office.com/e/M3j2M2hBFt");
  await expect(
    page.getByRole("link", { name: "Subscribe by email" }),
  ).toHaveAttribute("href", /^mailto:sympa@maillist.ox.ac.uk/);
});

test("the canvas renders, animates, pauses and respects reduced motion", async ({
  page,
}) => {
  await page.goto("");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const pixels = await canvas.evaluate((c) => {
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    return painted;
  });
  expect(pixels).toBeGreaterThan(1000);
  const first = await canvas.evaluate((c) => c.toDataURL());
  await page.waitForTimeout(180);
  expect(await canvas.evaluate((c) => c.toDataURL())).not.toBe(first);
  await page
    .getByRole("button", { name: "Pause animation", exact: true })
    .click();
  const paused = await canvas.evaluate((c) => c.toDataURL());
  await page.waitForTimeout(180);
  expect(await canvas.evaluate((c) => c.toDataURL())).toBe(paused);
  await page
    .getByRole("button", { name: "Play animation", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Play animation", exact: true }),
  ).toBeVisible();
});
