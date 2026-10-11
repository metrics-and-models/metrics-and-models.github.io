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
    ...content.details.map((t) => t.url.slice(1)),
  ];
  for (const url of pages) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('a[href*="internal_lab_sessions"]')).toHaveCount(
      0,
    );
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      outside: [
        ...document.querySelectorAll(
          "main h1, main h2, main h3, main p, main a, main button, main canvas",
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
    if (
      [
        "",
        "people/",
        "about/",
        "details/previous_talks.html",
        "details/emilycantrell.html",
      ].includes(url)
    )
      await page.screenshot({
        path: testInfo.outputPath(
          (url || "home").replaceAll("/", "-") + ".png",
        ),
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});

test("Christmas Eve is clearly marked as a seminar break", async ({
  page,
}, testInfo) => {
  await page.goto("");
  const notice = page.locator(".programme-break");
  await notice.scrollIntoViewIfNeeded();
  await expect(notice.getByText("No seminar", { exact: true })).toBeVisible();
  await expect(notice.getByRole("heading")).toHaveText(
    "Silent night. Silent Zoom.",
  );
  await expect(notice.locator("time")).toHaveAttribute(
    "datetime",
    "2026-12-24",
  );
  await expect(notice.locator("a, button")).toHaveCount(0);
  await expect(page.locator(".talk-row")).toHaveCount(content.upcoming.length);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("christmas-break.png") });
});

test("the internal meeting schedule is not served", async ({
  page,
  request,
}) => {
  for (const path of [
    "details/internal_lab_sessions.html",
    "details/internal_lab_sessions.md",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
  await page.goto("about/");
  await expect(page.locator("#lab-meetings")).toContainText(
    "Lab members also meet internally",
  );
  await expect(
    page.locator("#lab-meetings a, #lab-meetings time, #lab-meetings table"),
  ).toHaveCount(0);
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
  await expect(page.locator(".person-role")).toHaveCount(0);
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

test("all scientific sketches render, animate, pause and respect reduced motion", async ({
  page,
}) => {
  for (const [url, count] of [
    ["", 4],
    ["people/", 1],
    ["about/", 1],
    ["details/previous_talks.html", 1],
    ["details/emilycantrell.html", 1],
  ]) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(url);
    const canvases = page.locator("canvas[data-plot]");
    const button = page.locator(".motion-toggle");
    await expect(canvases).toHaveCount(count);
    const snapshots = () =>
      canvases.evaluateAll((items) => items.map((c) => c.toDataURL()));
    for (const canvas of await canvases.all()) {
      await canvas.scrollIntoViewIfNeeded();
      await expect(canvas).toBeInViewport();
      await expect
        .poll(() =>
          canvas.evaluate((c) => {
            const data = c
              .getContext("2d")
              .getImageData(0, 0, c.width, c.height).data;
            let painted = 0;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
            return painted;
          }),
        )
        .toBeGreaterThan(100);
    }
    const first = await snapshots();
    await page.waitForTimeout(250);
    (await snapshots()).forEach((frame, index) =>
      expect(frame, url + " plot " + index).not.toBe(first[index]),
    );
    await button.click();
    await expect(button).toHaveAttribute("aria-label", /^Play /);
    const paused = await snapshots();
    await page.waitForTimeout(250);
    expect(await snapshots()).toEqual(paused);
    await button.click();
    await expect(button).toHaveAttribute("aria-label", /^Pause /);
    await page.waitForTimeout(250);
    expect(await snapshots()).not.toEqual(paused);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(button).toHaveAttribute("aria-label", /^Play /);
    const reduced = await snapshots();
    await page.waitForTimeout(250);
    expect(await snapshots()).toEqual(reduced);

    await page.reload();
    await expect(button).toHaveAttribute("aria-label", /^Play /);
    await expect
      .poll(() => canvases.first().evaluate((c) => c.width))
      .toBeGreaterThan(0);
    await page.waitForTimeout(100);
    const initialReduced = await snapshots();
    await page.waitForTimeout(250);
    expect(await snapshots()).toEqual(initialReduced);
  }
});

test("sketches stay framed through a full network rotation and stop offscreen", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-10-11T12:00:00Z") });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("");
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date("2026-10-11T12:01:00Z"));
  const canvases = page.locator("canvas[data-plot]");
  for (let step = 0; step < 6; step++) {
    await page.clock.runFor(4000);
    const clipped = await canvases.evaluateAll((items) =>
      items
        .filter((canvas) => {
          const { width, height } = canvas;
          const pixels = canvas
            .getContext("2d")
            .getImageData(0, 0, width, height).data;
          const painted = (x, y) => pixels[(y * width + x) * 4 + 3] > 0;
          for (let x = 0; x < width; x++)
            if (painted(x, 0) || painted(x, height - 1)) return true;
          for (let y = 0; y < height; y++)
            if (painted(0, y) || painted(width - 1, y)) return true;
          return false;
        })
        .map((canvas) => canvas.dataset.plot),
    );
    expect(clipped, "animation sample " + step).toEqual([]);
  }
  await page.screenshot({ path: testInfo.outputPath("moving-sketches.png") });
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(canvases.first()).not.toBeInViewport();
  await page.clock.runFor(100);
  const snapshots = () =>
    canvases.evaluateAll((items) => items.map((canvas) => canvas.toDataURL()));
  const offscreen = await snapshots();
  await page.clock.runFor(1000);
  expect(await snapshots()).toEqual(offscreen);
});
