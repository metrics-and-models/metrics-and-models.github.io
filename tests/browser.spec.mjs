import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { loadContent, tableRows } from "../lib/content.mjs";

const now = new Date(JSON.parse(fs.readFileSync("dist/seminars/status.json", "utf8")).generatedAt);
const content = loadContent({ now });
const londonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);
const activeBreaks = JSON.parse(fs.readFileSync("site/_data/seminarBreaks.json", "utf8"))
  .filter((entry) => entry.date.iso >= londonDate);
const people = JSON.parse(fs.readFileSync("site/_data/people.json", "utf8"));
const plots = ["network", "distribution", "scatter", "heatmap", "series", "contours"];
const landingPlots = ["distribution"];

test("responsive pages have no overflow, broken assets or browser errors", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.isNavigationRequest() && /^(?:www\.)?metrics-and-models\.ai$/i.test(new URL(request.url()).hostname))
      errors.push("Navigation to former site: " + request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(response.url());
  });
  const pages = [
    "",
    "seminars/",
    "people/",
    "projects/",
    "about/",
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
          "main h1, main h2, main h3, main p, main a, main button",
        ),
      ]
        // Queued project cards are deliberately clipped at the edges and inert.
        .filter((el) => !el.closest("[inert]"))
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
    if (["", "seminars/", "people/", "projects/", "about/", "details/emilycantrell.html"].includes(url))
      await page.screenshot({
        path: testInfo.outputPath((url || "home").replaceAll("/", "-") + ".png"),
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});

test("the old previous-talks address lands on the seminars archive", async ({
  page,
}) => {
  await page.goto("details/previous_talks.html");
  await expect(page).toHaveURL(/\/seminars\/#previous$/);
  await expect(page.locator("#previous .section-heading h2")).toHaveText(
    "Previous talks",
  );
});

test("the brand stays on one line at the mobile navigation breakpoint", async ({
  page,
}) => {
  for (const url of ["", "people/"]) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const menu = page.locator(".menu-toggle");
    for (const width of [421, 480, 481]) {
      await page.setViewportSize({ width, height: 850 });
      const layout = await page.locator(".wordmark span").evaluate((name) => {
        const bounds = name.getBoundingClientRect();
        return {
          singleLine:
            bounds.height <= parseFloat(getComputedStyle(name).lineHeight) + 1,
          inside: document.documentElement.scrollWidth === innerWidth,
        };
      });
      expect(layout, url + " " + width).toEqual({ singleLine: true, inside: true });
      if (width <= 480) {
        await expect(menu).toBeVisible();
        await menu.click();
        await expect(page.locator("nav")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.locator("nav")).not.toBeVisible();
      } else {
        await expect(menu).not.toBeVisible();
        await expect(page.locator("nav")).toBeVisible();
      }
    }
  }
});

test("Christmas Eve is clearly marked as a seminar break", async ({
  page,
}, testInfo) => {
  test.skip(!content.next || !activeBreaks.some((entry) => entry.date.iso === "2026-12-24"), "The winter break is no longer forthcoming.");
  await page.goto("seminars/");
  const notice = page.locator("#forthcoming .deck-break");
  await notice.scrollIntoViewIfNeeded();
  await expect(notice).toBeVisible();
  await expect(notice.getByText("No seminar", { exact: true })).toBeVisible();
  await expect(notice.getByRole("heading")).toHaveText("Winter break");
  await expect(notice.locator("a, button")).toHaveCount(0);
  await expect(page.locator("#forthcoming a.deck-card")).toHaveCount(
    content.upcoming.length - 1,
  );
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
  await page.goto("seminars/#previous");
  const rows = page.locator("#previous .talk-row:visible");
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

test("completed talks are archived while the next talk and its detail page stay current", async ({
  page,
}) => {
  const schedule = tableRows(fs.readFileSync("README.md", "utf8"));
  const completed = schedule.filter((talk) => talk.date.iso && Date.parse(talk.date.iso) + 60 * 60 * 1000 <= now.getTime());
  await page.goto("seminars/");
  for (const talk of completed) {
    await expect(page.locator(`#previous .archive-title a[href$="${talk.url}"]`)).toHaveCount(1);
    await expect(page.locator(`#forthcoming a.deck-card[href$="${talk.url}"]`)).toHaveCount(0);
  }
  await expect(page.locator("#previous .talk-row")).toHaveCount(content.archive.length);
  if (content.next) {
    await expect(page.locator(".hero .button-white")).toHaveAttribute("href", new RegExp(content.next.url.replaceAll(".", "\\.") + "$"));
    await page.goto(content.next.url.slice(1));
    await expect(page.locator(".event-facts").getByRole("link", { name: "Add to calendar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Attend this talk" })).toBeVisible();
  } else {
    await expect(page.locator(".hero h1")).toHaveText("Open seminars");
    await expect(page.locator(".hero-lead")).toContainText("announced soon");
    await expect(page.locator("#forthcoming")).toHaveCount(0);
  }
  if (completed.length) {
    await page.goto(completed[0].url.slice(1));
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: "Attend this talk" })).toHaveCount(0);
  }
});

test("navigation is keyboard accessible on mobile and desktop", async ({
  page,
}) => {
  await page.goto("");
  const menu = page.locator(".menu-toggle");
  const nav = page.getByRole("navigation");
  if (await menu.isVisible()) {
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
  }
  await expect(page.locator("#main-nav a")).toHaveText([
    "People",
    "Open seminars",
    "Projects",
    "About",
  ]);
  await nav.getByRole("link", { name: "People" }).click();
  await expect(page.locator("h1")).toHaveText("People");
  await expect(page.locator(".person")).toHaveCount(people.length);
  await expect(page.locator("#main-nav a[aria-current]")).toHaveText("People");
  if (await menu.isVisible()) await menu.click();
  await nav.getByRole("link", { name: "Open seminars" }).click();
  await expect(page).toHaveURL(/\/seminars\/$/);
  if (content.next && (content.upcoming.length > 1 || activeBreaks.length))
    await expect(page.locator("#forthcoming h2")).toHaveText("Forthcoming");
  else
    await expect(page.locator("#forthcoming")).toHaveCount(0);
  if (await menu.isVisible()) await menu.click();
  await nav.getByRole("link", { name: "Projects" }).click();
  await expect(page.locator("h1")).toHaveText("Projects");
  await page
    .getByRole("link", { name: "Metrics and Models home", exact: true })
    .click();
  await expect(page.locator(".landing-title")).toHaveAccessibleName(
    "Metrics and Models",
  );
});

test("page backgrounds are white and the desktop header navigation stays horizontal", async ({
  page,
}) => {
  for (const url of ["", "seminars/", "people/", "projects/", "about/"]) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(page.locator(".landing, .hero")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    if (page.viewportSize().width <= 480) continue;
    const layout = await page.locator("#main-nav").evaluate((nav) => {
      const links = [...nav.querySelectorAll("a")].map((link) => link.getBoundingClientRect());
      const header = nav.closest(".header-inner").getBoundingClientRect();
      const bounds = nav.getBoundingClientRect();
      return {
        sameRow: links.every((link) => Math.abs(link.top - links[0].top) < 2),
        leftToRight: links.every((link, index) => !index || link.left > links[index - 1].right),
        alignedRight: Math.abs(bounds.right - header.right) < 2,
      };
    });
    expect(layout, url || "home").toEqual({ sameRow: true, leftToRight: true, alignedRight: true });
  }
});

test("a talk card opens a preview over the page, then leads to details and the calendar", async ({
  page,
}) => {
  test.skip(!content.next, "No forthcoming talk to preview.");
  await page.goto("");
  const card = page.locator(".card-deck a.deck-card").first();
  const dialog = page.locator("#" + (await card.getAttribute("data-dialog")));
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading")).toHaveText(content.next.title);
  await expect(dialog.locator(".next-marker")).toHaveText("Next talk");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  // Clicking outside the preview also closes it.
  await card.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).not.toBeVisible();
  await card.click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).not.toBeVisible();

  await card.click();
  await dialog.getByRole("link", { name: "Talk details" }).click();
  await expect(page.locator("h1")).toHaveText(content.next.title);
  await expect(page.locator(".talk-copy")).toContainText("Abstract");
  const download = page.waitForEvent("download");
  await page.locator(".event-facts").getByRole("link", { name: "Add to calendar" }).click();
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

test("the landing banner types its label, fills the screen and settles shorter on scroll", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("");
  await page.evaluate(() => document.fonts.ready);
  const label = page.locator(".landing [data-typing]");
  await expect(label).toHaveAttribute("aria-label", "// health & social data science");
  await expect(label).toHaveText("// health & social data science", { timeout: 8000 });
  const landing = page.locator(".landing");
  const before = (await landing.boundingBox()).height;
  expect(before).toBeGreaterThan(page.viewportSize().height * 0.6);
  await expect(page.locator(".landing-title")).toBeInViewport({ ratio: 1 });
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => landing.evaluate((el) => el.style.getPropertyValue("--collapse")))
    .toBe("1.000");
  // On narrow phones the wrapped title limits how far it can shrink.
  expect((await landing.boundingBox()).height).toBeLessThan(
    page.viewportSize().width > 480 ? before * 0.8 : before,
  );

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(label).toHaveText("// health & social data science");
  await expect(label.locator(".typing-cursor")).toHaveCount(0);
});

test("featured publications rotate, respond to tabs and stay still with reduced motion", async ({
  page,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("");
  const carousel = page.locator("#publications [data-carousel]");
  const slides = carousel.locator(".feature-slide");
  const tabs = carousel.getByRole("tab");
  await expect(slides.nth(0)).toBeVisible();
  await page.clock.runFor(7100);
  await expect(slides.nth(1)).toBeVisible();
  await expect(slides.nth(0)).toBeHidden();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await tabs.nth(3).click();
  await expect(slides.nth(3)).toBeVisible();
  await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
  // While the pointer rests on the panel it does not advance.
  await carousel.hover();
  await page.clock.runFor(15000);
  await expect(slides.nth(3)).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.mouse.move(0, 0);
  await page.clock.runFor(15000);
  await expect(slides.nth(0)).toBeVisible();
});

test("banner animations render, keep moving, pause and respect reduced motion", async ({
  page,
}) => {
  for (const url of ["", "seminars/", "people/", "projects/", "about/", "details/emilycantrell.html"]) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(url);
    const canvas = page.locator("canvas[data-plot]");
    const button = page.locator("[data-animation-group] .motion-toggle");
    await expect(canvas).toHaveCount(url ? 1 : landingPlots.length);
    const types = await canvas.evaluateAll((items) => items.map((c) => c.dataset.plot));
    if (url) expect(plots, url).toContain(types[0]);
    else expect(types).toEqual(landingPlots);
    await expect
      .poll(() =>
        canvas.evaluateAll((items) => {
          const painted = items.map((c) => {
            const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
            let count = 0;
            for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
            return count;
          });
          return Math.min(...painted);
        }),
      )
      .toBeGreaterThan(url ? 1000 : 100);
    const snapshot = () => canvas.evaluateAll((items) => items.map((c) => c.toDataURL()));
    const first = await snapshot();
    await page.waitForTimeout(250);
    const moving = await snapshot();
    moving.forEach((frame, index) => expect(frame, (url || "home") + " " + types[index] + " moves").not.toBe(first[index]));
    await button.click();
    await expect(button).toHaveAttribute("aria-label", /^Play /);
    const paused = await snapshot();
    await page.waitForTimeout(250);
    expect(await snapshot(), url + " pauses").toEqual(paused);
    await button.click();
    await expect(button).toHaveAttribute("aria-label", /^Pause /);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(button).toHaveAttribute("aria-label", /^Play /);
    const reduced = await snapshot();
    await page.waitForTimeout(250);
    expect(await snapshot(), url + " reduced motion").toEqual(reduced);
  }
});

test("the landing 3D distribution appears gradually and is immediate with reduced motion", async ({
  page,
}) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("");
  const sketches = page.locator(".landing canvas[data-plot]");
  await expect(sketches).toHaveCount(1);
  const opacity = () => sketches.evaluateAll((items) => items.map((canvas) => Number(getComputedStyle(canvas).opacity)));
  const initial = await opacity();
  await page.clock.runFor(1200);
  const appearing = await opacity();
  await page.clock.runFor(6000);
  const revealed = await opacity();
  expect(appearing[0]).toBeGreaterThan(initial[0]);
  expect(appearing[0]).toBeLessThan(revealed[0]);
  revealed.forEach((value, index) => expect(value).toBeGreaterThan(initial[index]));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect.poll(opacity).toEqual(revealed);
  await page.clock.runFor(6000);
  expect(await opacity()).toEqual(revealed);
});

test("animations stop while scrolled out of view", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // A short window leaves enough scroll range to hide the banner.
  await page.setViewportSize({ ...page.viewportSize(), height: 600 });
  await page.goto("about/");
  const canvas = page.locator("canvas[data-plot]");
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(canvas).not.toBeInViewport();
  await page.clock.runFor(100);
  const offscreen = await canvas.evaluate((c) => c.toDataURL());
  await page.clock.runFor(1000);
  expect(await canvas.evaluate((c) => c.toDataURL())).toBe(offscreen);
});

test("highlighted projects rotate with the highlighted card in the middle", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("projects/");
  await page.mouse.move(0, 0);
  const queue = page.locator("[data-queue]");
  const cards = queue.locator(".queue-card");
  const current = queue.locator("[data-queue-current]");
  const fill = queue.locator(".queue-progress > span");
  const slots = () => cards.evaluateAll((items) => items.map((card) => card.dataset.slot));
  const filled = () => fill.evaluate((bar) => bar.getBoundingClientRect().width);
  expect(await slots()).toEqual(["centre", "right", "off-right", "left"]);
  await expect(current).toHaveText("01");
  // The highlighted card is centred, with one card visible either side.
  const stage = await queue.locator(".queue-stage").boundingBox();
  const centre = await cards.first().boundingBox();
  expect(Math.abs(centre.x + centre.width / 2 - (stage.x + stage.width / 2))).toBeLessThan(2);

  // The progress bar fills from left to right, then the queue advances.
  await page.waitForTimeout(1500);
  const partway = await filled();
  expect(partway).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(await filled()).toBeGreaterThan(partway);
  await expect(current).toHaveText("02", { timeout: 9000 });
  expect(await slots()).toEqual(["left", "centre", "right", "off-left"]);
  expect(await cards.nth(1).evaluate((card) => card.inert)).toBe(false);
  expect(await cards.first().evaluate((card) => card.inert)).toBe(true);

  // Hovering pauses the fill where it is.
  await page.waitForTimeout(1000);
  await queue.locator(".queue-stage").hover();
  const held = await filled();
  await page.waitForTimeout(800);
  expect(await filled()).toBe(held);
  await expect(current).toHaveText("02");
  await queue.getByRole("button", { name: "Previous project" }).click();
  await expect(current).toHaveText("01");
  expect(await slots()).toEqual(["centre", "right", "off-right", "left"]);
  await queue.getByRole("button", { name: "Next project" }).click();
  await expect(current).toHaveText("02");

  // With reduced motion the queue stays put and the bar does not fill.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1000);
  expect(await filled()).toBe(0);
  await expect(current).toHaveText("01");
});
