import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { load } from "cheerio";
import {
  loadContent,
  parseDate,
  calendarEvent,
  tableRows,
} from "../lib/content.mjs";
import { needsSeminarRefresh } from "../scripts/check-seminar-refresh.mjs";

const now = new Date(JSON.parse(fs.readFileSync("dist/seminars/status.json", "utf8")).generatedAt);
const content = loadContent({ now });
const prefix = (process.env.PATH_PREFIX || "").replace(/\/$/, "");
const origin = process.env.SITE_URL || "https://metrics-and-models.ai";
const production = process.env.SITE_ENV === "production";
const html = (url) => load(fs.readFileSync("dist" + url, "utf8"));
const people = JSON.parse(fs.readFileSync("site/_data/people.json", "utf8"));
const breaks = JSON.parse(
  fs.readFileSync("site/_data/seminarBreaks.json", "utf8"),
);
const londonDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);
const activeBreaks = breaks.filter((entry) => entry.date.iso >= londonDate);
const publications = JSON.parse(
  fs.readFileSync("site/_data/publications.json", "utf8"),
);
const highlights = JSON.parse(
  fs.readFileSync("site/_data/highlights.json", "utf8"),
);
// The old previous-talks address is now a redirect stub, not a full page.
const redirects = ["details/previous_talks.html"];
const pages = () =>
  fs
    .readdirSync("dist", { recursive: true })
    .filter((file) => file.endsWith(".html") && !redirects.includes(file));

// Isolate schedule edge cases from the real programme without rewriting source files.
function withScheduleFixture(upcoming, archive, check) {
  const originalDirectory = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "seminar-schedule-"));
  const table = (rows) => [
    "| Speaker | Date | Title | More Details |",
    "| --- | --- | --- | --- |",
    ...rows.map(([speaker, date, url]) =>
      `| ${speaker} | ${date} | A seminar | [Details](${url}) |`,
    ),
  ].join("\n");
  fs.mkdirSync(path.join(directory, "details"));
  fs.writeFileSync(path.join(directory, "README.md"), table(upcoming));
  fs.writeFileSync(path.join(directory, "details/previous_talks.md"), table(archive));
  try {
    process.chdir(directory);
    return check();
  } finally {
    process.chdir(originalDirectory);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("hourly checks rebuild only for due transitions or an invalid published status", () => {
  const clock = Date.parse("2026-10-29T15:00:00.000Z");
  const status = {
    generatedAt: "2026-10-16T14:00:00.000Z",
    nextTransitionAt: "2026-10-29T15:00:00.000Z",
  };
  assert.equal(needsSeminarRefresh(status, clock - 1), false);
  assert.equal(needsSeminarRefresh(status, clock), true);
  assert.equal(needsSeminarRefresh(status, clock + 1), true);
  assert.equal(needsSeminarRefresh({ ...status, nextTransitionAt: null }, clock), false);
  for (const invalid of [
    null,
    {},
    { ...status, generatedAt: "invalid" },
    { ...status, generatedAt: "2030-01-01T00:00:00.000Z", nextTransitionAt: null },
    { ...status, nextTransitionAt: "2026-02-30T15:00:00.000Z" },
    { ...status, nextTransitionAt: "tomorrow" },
  ]) assert.equal(needsSeminarRefresh(invalid, clock), true);
});

test("a talk remains upcoming until its one-hour slot ends, in BST and GMT", () => {
  for (const [url, end, nextUrl] of [
    ["/details/emilycantrell.html", "2026-10-15T14:00:00.000Z", "/details/bengreen.html"],
    ["/details/bengreen.html", "2026-10-29T15:00:00.000Z", "/details/perblock.html"],
  ]) {
    const before = loadContent({ now: new Date(Date.parse(end) - 1) });
    assert.equal(before.generatedAt, new Date(Date.parse(end) - 1).toISOString());
    assert.equal(before.nextTransitionAt, end);
    assert.equal(before.next.url, url);
    assert.ok(before.upcoming.some((talk) => talk.url === url));
    assert.ok(!before.archive.some((talk) => talk.url === url));
    const after = loadContent({ now: end });
    assert.equal(after.next.url, nextUrl);
    assert.ok(!after.upcoming.some((talk) => talk.url === url));
    assert.equal(after.archive.filter((talk) => talk.url === url).length, 1);
    const detail = after.details.find((talk) => talk.url === url);
    assert.equal(detail.archived, true);
    assert.equal(detail.calendar, before.details.find((talk) => talk.url === url).calendar);
  }
});

test("archiving preserves source files, stable URLs, details and the complete programme", () => {
  const sources = ["README.md", "details/previous_talks.md"];
  const originals = sources.map((file) => fs.readFileSync(file, "utf8"));
  const before = loadContent({ now: "2026-10-15T12:00:00Z" });
  const after = loadContent({ now: "2030-01-01T00:00:00Z" });
  assert.equal(after.upcoming.length, 0);
  assert.equal(after.next, undefined);
  assert.equal(after.nextTransitionAt, null);
  assert.equal(after.total, before.total);
  assert.equal(after.archive.length, before.total);
  assert.deepEqual(
    after.archive.map((talk) => talk.url).sort(),
    [...before.upcoming, ...before.archive].map((talk) => talk.url).sort(),
  );
  assert.deepEqual(after.details.map((talk) => talk.url), before.details.map((talk) => talk.url));
  assert.deepEqual(sources.map((file) => fs.readFileSync(file, "utf8")), originals);
});

test("the refresh status describes the built programme and its next automatic transition", () => {
  const status = JSON.parse(fs.readFileSync("dist/seminars/status.json", "utf8"));
  assert.equal(status.generatedAt, content.generatedAt);
  assert.equal(status.nextTransitionAt, content.nextTransitionAt);
  const ends = content.upcoming
    .filter((talk) => talk.date.iso)
    .map((talk) => Date.parse(talk.date.iso) + 60 * 60 * 1000)
    .filter((end) => end > now.getTime())
    .sort((a, b) => a - b);
  assert.equal(status.nextTransitionAt, ends.length ? new Date(ends[0]).toISOString() : null);
});

test("unknown dates remain upcoming and manually archived talks stay archived without duplicates", () => {
  withScheduleFixture(
    [
      ["Unknown date", "TBC", "/details/unknown.html"],
      ["Next dated talk", "14:00 GMT, 29th October, 2026", "/details/next.html"],
      ["Manually archived", "14:00 GMT, 12th November, 2026", "/details/moved.html"],
    ],
    [["Manually archived", "14:00 GMT, 12th November, 2026", "/details/moved.html"]],
    () => {
      const result = loadContent({ now: "2026-10-16T00:00:00Z" });
      assert.equal(result.next.url, "/details/next.html");
      assert.equal(result.upcoming.find((talk) => talk.url === "/details/unknown.html").archived, false);
      assert.equal(result.archive.filter((talk) => talk.url === "/details/moved.html").length, 1);
      assert.ok(!result.upcoming.some((talk) => talk.url === "/details/moved.html"));
      assert.equal(result.total, 3);
    },
  );
});

test("all source schedule rows and detail permalinks survive automatic archiving", () => {
  const events = [...content.upcoming, ...content.archive];
  const sourceRows = [];
  for (const source of ["README.md", "details/previous_talks.md"]) {
    const rows = tableRows(fs.readFileSync(source, "utf8"));
    sourceRows.push(...rows);
    for (const row of rows) {
      const event = events.find(
        (event) =>
          event.speaker === row.speaker && event.date.label === row.date.label,
      );
      assert.ok(event, row.speaker);
      assert.equal(event.title, row.title);
      assert.equal(event.url, row.url);
    }
  }
  assert.equal(content.total, new Set(sourceRows.map((event) => event.url)).size);
  assert.equal(new Set(events.map((event) => event.url)).size, events.length);
  for (const event of events) {
    assert.ok(event.date.iso, event.speaker + ": date must be parsed");
    if (event.url.startsWith("/"))
      assert.ok(fs.existsSync("dist" + event.url), event.url);
  }
  for (const detail of content.details) {
    const $ = html(detail.url);
    assert.equal(
      $("main h1").text(),
      /^(TBC|TBD)$/.test(detail.title) ? "Title forthcoming" : detail.title,
    );
    assert.equal(
      $(".talk-copy").text().replace(/\s+/g, " ").trim(),
      load(detail.body).text().replace(/\s+/g, " ").trim(),
    );
    assert.equal($("main h1").length, 1);
  }
});

test("the homepage spotlights the next four programme entries and marks the next talk", () => {
  const $ = html("/index.html");
  assert.equal($(".landing-title").attr("aria-label"), "Metrics and Models");
  assert.equal($("main h1").length, 1);
  const programme = (content.next ? [...content.upcoming, ...activeBreaks.map((b) => ({ ...b, isBreak: true }))] : [])
    .sort((a, b) => a.date.iso.localeCompare(b.date.iso))
    .slice(0, 4);
  const cards = $(".card-deck > .deck-card");
  assert.equal(cards.length, programme.length);
  programme.forEach((entry, index) => {
    const card = cards.eq(index);
    if (entry.isBreak) {
      assert.ok(card.is("aside"));
      return;
    }
    assert.equal(card.attr("href"), prefix + entry.url);
    assert.ok(card.text().includes(entry.speaker));
    if (entry.institution)
      assert.equal(card.find(".deck-institution").text(), entry.institution);
    // Each card opens a preview dialog for the same talk.
    const dialog = $("#" + card.attr("data-dialog"));
    assert.ok(dialog.is("dialog"));
    assert.equal(
      dialog.find("h3").text(),
      /^(TBC|TBD)$/.test(entry.title) ? "Title forthcoming" : entry.title,
    );
    assert.equal(dialog.find(".button-solid").attr("href"), prefix + entry.url);
  });
  const marked = cards.filter((_, card) => $(card).find(".next-marker").length);
  assert.equal(marked.length, content.next ? 1 : 0);
  if (content.next) {
    assert.equal(marked.attr("href"), prefix + content.next.url);
    assert.equal(marked.find(".next-marker").text(), "Next talk");
    assert.equal($(".landing-next").attr("href"), prefix + content.next.url);
  } else {
    assert.equal($(".landing-next").attr("href"), undefined);
    assert.match($(".landing-next").text(), /announced soon/);
  }
});

test("the seminars page leads with the next talk, then forthcoming cards and the archive", () => {
  const $ = html("/seminars/index.html");
  assert.equal(
    $("main h1").text(),
    !content.next ? "Open seminars" : /^(TBC|TBD)$/.test(content.next.title) ? "Title forthcoming" : content.next.title,
  );
  if (content.next)
    assert.equal($(".hero .button-white").attr("href"), prefix + content.next.url);
  else
    assert.match($(".hero-lead").text(), /announced soon/);
  const forthcoming = $("#forthcoming .deck-card");
  assert.equal(forthcoming.length, content.next ? content.upcoming.length - 1 + activeBreaks.length : 0);
  for (const talk of content.upcoming.slice(1))
    assert.equal($('#forthcoming a.deck-card[href="' + prefix + talk.url + '"]').length, 1);
  assert.equal($("#forthcoming .next-marker").length, 0);
  assert.equal($("#previous .talk-row").length, content.archive.length);
  content.archive.forEach((talk, index) =>
    assert.ok($("#previous .talk-row").eq(index).text().includes(talk.title === "TBC" ? "Title forthcoming" : talk.title)),
  );
});

test("Christmas Eve is a break in the programme, not a seminar", () => {
  const $ = html("/seminars/index.html");
  const notice = $("#forthcoming .deck-break");
  if (!content.next || !activeBreaks.some((entry) => entry.date.iso === "2026-12-24")) {
    assert.equal(notice.length, 0);
    return;
  }
  assert.equal(notice.length, 1);
  assert.match(notice.attr("aria-label"), /24 Dec 2026/);
  assert.match(notice.text(), /No seminar/);
  assert.equal(notice.find("h3").text(), "Winter break");
  assert.match(notice.find(".deck-text").text(), /Christmas Eve/);
  assert.match(notice.prevAll("a.deck-card").first().text(), /Ilya Kashnitsky/);
  assert.match(notice.nextAll("a.deck-card").first().text(), /Yang Chen/);
  assert.equal(notice.find("a, button, .next-marker").length, 0);
  assert.ok(
    content.upcoming.every((talk) => !talk.date.iso.startsWith("2026-12-24")),
  );
  assert.equal($("#previous .deck-break").length, 0);
});

test("the old previous-talks address redirects to the seminars archive", () => {
  const $ = html("/details/previous_talks.html");
  assert.equal(
    $('meta[http-equiv="refresh"]').attr("content"),
    "0; url=" + prefix + "/seminars/#previous",
  );
  assert.equal($('meta[name="robots"]').attr("content"), "noindex, nofollow");
  assert.equal($('link[rel="canonical"]').attr("href"), origin + prefix + "/seminars/");
  assert.equal($("a").attr("href"), prefix + "/seminars/#previous");
});

test("summer and winter seminar times convert correctly to UTC", () => {
  assert.equal(
    parseDate("14:00 BST, 15th October, 2026").iso,
    "2026-10-15T13:00:00.000Z",
  );
  assert.equal(
    parseDate("14:00 GMT, 29th October, 2026").iso,
    "2026-10-29T14:00:00.000Z",
  );
  assert.equal(
    parseDate("14:00 GMT, 7th January, 2027").iso,
    "2027-01-07T14:00:00.000Z",
  );
  assert.equal(parseDate("TBC").iso, "");
});

test("calendar files preserve times, escape content, fold UTF-8 lines and link to this deployment", () => {
  const events = [...content.upcoming, ...content.archive].filter((talk) => talk.calendar);
  assert.equal(fs.readdirSync("dist/calendar").length, events.length);
  for (const event of events) {
    const ics = fs.readFileSync("dist" + event.calendar, "utf8");
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    const unfolded = ics.replace(/\r\n /g, "");
    assert.ok(
      unfolded.includes(
        "DTSTART:" + event.date.iso.replace(/[-:]/g, "").replace(".000", ""),
      ),
    );
    assert.ok(unfolded.includes("URL:" + origin + prefix + event.url));
    assert.ok(unfolded.includes(origin + prefix + "/about/#join"));
    assert.ok(
      unfolded.includes(
        "UID:" + path.basename(event.url, ".html") + "@metrics-and-models.github.io",
      ),
    );
    for (const line of ics.split("\r\n"))
      assert.ok(Buffer.byteLength(line) <= 75);
  }
  const escaped = calendarEvent({
    ...[...content.upcoming, ...content.archive].find((talk) => talk.date.iso),
    title: "Data, models;\nand " + "é".repeat(100),
  }).replace(/\r\n /g, "");
  assert.ok(escaped.includes("Data\\, models\\;\\nand "));
});

test("all generated internal links, fragments and assets resolve, including the deployment prefix", () => {
  for (const file of pages()) {
    const $ = html("/" + file);
    assert.equal(
      $('meta[name="robots"]').attr("content"),
      production && file !== "404.html" ? undefined : "noindex, nofollow",
    );
    const canonical = origin + prefix + "/" + file.replace(/index\.html$/, "");
    assert.equal(
      $('link[rel="canonical"]').attr("href"),
      file === "404.html" ? undefined : canonical,
    );
    assert.equal($('meta[property="og:url"]').attr("content"), canonical);
    for (const element of $("[href],[src]").toArray()) {
      for (const attribute of ["href", "src"]) {
        const value = $(element).attr(attribute);
        if (!value || /^(https?:|mailto:|data:|\/\/)/.test(value)) continue;
        const url = new URL(
          value,
          "https://test.invalid" + prefix + "/" + file,
        );
        if (prefix)
          assert.ok(url.pathname.startsWith(prefix + "/"), file + ": " + value);
        const target = url.pathname.slice(prefix.length);
        const output = path.join(
          "dist",
          target.endsWith("/") ? target + "index.html" : target,
        );
        assert.ok(fs.existsSync(output), file + ": missing " + value);
        if (url.hash && output.endsWith(".html")) {
          const targetDoc = load(fs.readFileSync(output, "utf8"));
          assert.ok(
            targetDoc("[id]")
              .toArray()
              .some(
                (el) =>
                  targetDoc(el).attr("id") ===
                  decodeURIComponent(url.hash.slice(1)),
              ),
            file + ": missing fragment " + value,
          );
        }
      }
    }
  }
});

test("search indexing is allowed only on production, never the preview", () => {
  const robots = fs.readFileSync("dist/robots.txt", "utf8");
  if (production) {
    assert.match(robots, /^Allow: \/$/m);
    assert.match(robots, /^Disallow: \/dev\/$/m);
    assert.doesNotMatch(robots, /^Disallow: \/$/m);
  } else {
    assert.match(robots, /^Disallow: \/$/m);
    assert.doesNotMatch(robots, /^Allow:/m);
  }
  const $ = html("/index.html");
  assert.equal(
    $(".footer-links a").last().attr("href"),
    "https://github.com/metrics-and-models/metrics-and-models.github.io/tree/" +
      (production ? "main" : "dev"),
  );
});

test("styles and scripts are versioned by their content on every page", () => {
  for (const file of pages()) {
    const $ = html("/" + file);
    const assets = $("link[rel=stylesheet], script[src]");
    assert.ok(assets.length >= 2, file);
    assets.each((_, element) => {
      const value = $(element).attr("href") || $(element).attr("src");
      const url = new URL(value, "https://test.invalid");
      const version = createHash("sha256")
        .update(fs.readFileSync("dist" + url.pathname.slice(prefix.length)))
        .digest("hex")
        .slice(0, 12);
      assert.equal(url.searchParams.get("v"), version, file + ": " + value);
    });
  }
});

test("the logo is the favicon only, with a text wordmark linking home", () => {
  assert.deepEqual(
    fs.readFileSync("dist/assets/legacy-logo.png"),
    fs.readFileSync("assets/metrics_and_models_logo.png"),
  );
  for (const file of pages()) {
    const $ = html("/" + file);
    const brand = $(".site-header .wordmark");
    assert.equal(
      $('.partners, img[src$="/oxford-partners.png"]').length,
      0,
      file + ": no departmental logo strip",
    );
    assert.equal(brand.attr("href"), prefix + "/");
    assert.equal(brand.attr("aria-label"), "Metrics and Models home");
    assert.equal(brand.text().trim(), "Metrics and Models");
    assert.equal($('img[src$="/assets/legacy-logo.png"]').length, 0, file);
    assert.equal(
      $("link[rel=icon]").attr("href"),
      prefix + "/assets/legacy-logo.png",
    );
  }
});

test("the header links to people, open seminars, projects and about, with the brand linking home", () => {
  for (const file of pages()) {
    const $ = html("/" + file);
    assert.deepEqual(
      $("#main-nav a").toArray().map((link) => [$(link).text(), $(link).attr("href")]),
      [
        ["People", prefix + "/people/"],
        ["Open seminars", prefix + "/seminars/"],
        ["Projects", prefix + "/projects/"],
        ["About", prefix + "/about/"],
      ],
      file,
    );
    assert.equal($(".site-header .wordmark").attr("href"), prefix + "/");
  }
});

test("every page has one animated banner with a pause control", () => {
  for (const file of pages().filter((file) => file !== "404.html")) {
    const $ = html("/" + file);
    const banner = $("[data-animation-group]");
    assert.equal(banner.length, 1, file);
    assert.equal(banner.find(".motion-toggle").length, 1, file);
    const canvas = banner.find("canvas[data-plot]");
    canvas.each((_, sketch) => assert.equal($(sketch).attr("aria-hidden"), "true", file));
    if (file === "index.html") {
      assert.deepEqual(canvas.toArray().map((sketch) => $(sketch).attr("data-plot")), [
        "flow", "network", "distribution", "scatter",
      ]);
    }
    else {
      assert.equal(canvas.length, 1, file);
      assert.equal(canvas.attr("data-plot"), "random", file);
      assert.equal(canvas.attr("data-fit"), "right", file);
      // The notice row links to the next talk everywhere but the seminars
      // page, whose banner is the next talk.
      if (file !== "seminars/index.html") {
        assert.equal(banner.find(".hero-notice").attr("href"), content.next ? prefix + content.next.url : undefined, file);
        if (!content.next) assert.match(banner.find(".hero-notice").text(), /announced soon/, file);
      }
    }
  }
});

test("lab profiles support optional links, photos and interests without a hierarchy", () => {
  const people = JSON.parse(fs.readFileSync("site/_data/people.json", "utf8"));
  const $ = html("/people/index.html");
  assert.equal($(".person").length, people.length);
  assert.equal(
    new Set(people.map((person) => person.name)).size,
    people.length,
  );
  for (const [index, person] of people.entries()) {
    const profile = $(".person").eq(index);
    assert.ok(person.name);
    assert.equal(person.role, "Lab member");
    assert.equal(profile.find(".person-role").length, 0);
    assert.doesNotMatch(profile.text(), /\bLab member\b/i);
    assert.equal(profile.find("h2").text().trim(), person.name);
    if (person.url) {
      assert.ok(/^https:\/\//.test(person.url));
      assert.equal(profile.find(".person-homepage").attr("href"), person.url);
      assert.equal(
        profile.find(".person-homepage").text().trim(),
        person.urlLabel || "Website",
      );
    } else {
      assert.equal(profile.find(".person-homepage").length, 0);
    }
    assert.ok(Array.isArray(person.interests));
    for (const interest of person.interests)
      assert.ok(profile.find(".person-interests").text().includes(interest));
    assert.equal(profile.find(".person-bio").text(), person.bio || "");
    assert.equal(profile.find("img").length, person.photo ? 1 : 0);
    if (person.photo) {
      assert.ok(person.photo.startsWith("/assets/people/"));
      assert.equal(profile.find("img").attr("src"), prefix + person.photo);
      assert.equal(profile.find("img").attr("alt"), person.name);
      assert.ok(fs.statSync("site" + person.photo).size > 0);
    }
    for (const link of person.links || []) {
      assert.ok(/^https:\/\//.test(link.url));
      assert.ok(
        profile
          .find(".person-links a")
          .toArray()
          .some(
            (el) =>
              $(el).attr("href") === link.url &&
              $(el).text().trim() === link.label,
          ),
      );
    }
    for (const link of profile.find(".person-links a").toArray()) {
      assert.equal($(link).attr("target"), "_blank");
      assert.equal($(link).attr("rel"), "noopener");
      assert.equal(
        $(link).attr("aria-label"),
        person.name + ": " + $(link).text().trim(),
      );
    }
  }
  assert.doesNotMatch(
    $("main").text(),
    /Organising team|Transfer of Status|assessors|supervisors/i,
  );
});

test("the lab is introduced separately from its open seminar programme", () => {
  const home = html("/index.html");
  const about = html("/about/index.html");
  assert.equal(
    home(".landing-lead").text(),
    "A lab at the University of Oxford, developing computational methods for complex problems.",
  );
  assert.deepEqual(
    home(".landing-links a").toArray().map((a) => [home(a).text(), home(a).attr("href")]),
    [
      ["Join the seminar", prefix + "/seminars/"],
      ["Meet the lab", prefix + "/people/"],
    ],
  );
  assert.equal(home("#upcoming h2").text(), content.next ? "Open talks · Next up" : "Open talks");
  assert.match(home("#upcoming .section-intro").text(), content.next ? /open to everyone/ : /announced soon/);
  assert.match(
    about(".hero-lead").text(),
    /develop computational methods for complex problems/,
  );
  assert.ok(
    about(".editorial-section").first().text().includes(
      "We are a group of scholars from the Demographic Science Unit, the Oxford Internet Institute, Engineering Sciences, and the Department of Sociology.",
    ),
  );
  for (const page of [home, about, html("/people/index.html")]) {
    assert.doesNotMatch(
      page("main").text(),
      /flat structure|everyone is a lab member|lab leader/i,
    );
    assert.match(
      page('meta[name="description"]').attr("content"),
      /developing computational methods/,
    );
  }
  assert.match(about("#join").text(), /do not need to be a lab member/);
});

test("publication data is well formed and credits only listed lab members", () => {
  const names = new Set(people.map((person) => person.name));
  for (const person of people) {
    if (person.orcid) assert.match(person.orcid, /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, person.name);
    for (const id of [person.openalex ?? []].flat())
      assert.match(id, /^A\d+$/, person.name);
  }
  assert.ok(publications.length > 0 && publications.length <= 12);
  for (const list of [publications, highlights])
    for (const paper of list) {
      assert.ok(paper.title && paper.journal && paper.year, paper.title);
      assert.match(paper.url, /^https:\/\//, paper.title);
      assert.match(paper.date, /^\d{4}-\d{2}-\d{2}$/, paper.title);
      assert.ok(paper.members.length > 0, paper.title);
      for (const member of paper.members) assert.ok(names.has(member), member);
    }
  assert.deepEqual(
    publications.map((paper) => paper.date),
    publications.map((paper) => paper.date).sort().reverse(),
  );
  assert.equal(new Set(publications.map((paper) => paper.url)).size, publications.length);
});

test("the homepage features the latest four papers and Projects the curated highlights", () => {
  const home = html("/index.html");
  const projects = html("/projects/index.html");
  const papers = publications.slice(0, 4);
  const slides = home(".feature-slide");
  assert.equal(slides.length, papers.length);
  assert.equal(home('.feature-tabs [role="tab"]').length, papers.length);
  papers.forEach((paper, index) => {
    assert.equal(slides.eq(index).find("h3 a").text(), paper.title);
    assert.equal(slides.eq(index).find("h3 a").attr("href"), paper.url);
    assert.equal(slides.eq(index).attr("hidden") !== undefined, index > 0);
    assert.equal(
      home('.feature-tabs [role="tab"]').eq(index).attr("aria-selected"),
      String(index === 0),
    );
  });
  const cards = projects("[data-queue] .queue-card");
  assert.equal(cards.length, highlights.length);
  highlights.forEach((paper, index) => {
    assert.equal(cards.eq(index).find("h3 a").text(), paper.title);
    assert.equal(cards.eq(index).find("h3 a").attr("href"), paper.url);
    const expected =
      index === 0 ? "centre" : index === 1 ? "right" : index === highlights.length - 1 ? "left" : "off-right";
    assert.equal(cards.eq(index).attr("data-slot"), expected);
  });
  assert.equal(projects(".queue-count").text().trim(), "01 / " + String(highlights.length).padStart(2, "0"));
  assert.equal(projects("#publications .talk-row").length, publications.length);
});

test("the public site mentions lab meetings only on About and never publishes their schedule", () => {
  assert.equal("internal" in content, false);
  const files = fs.readdirSync("dist", { recursive: true });
  assert.ok(files.every((file) => !file.includes("internal_lab_sessions")));
  const about = html("/about/index.html");
  assert.equal(
    about("#lab-meetings p").text(),
    "Lab members also meet internally to share work in progress and discuss collaborations.",
  );
  assert.equal(
    about("#lab-meetings a, #lab-meetings time, #lab-meetings table").length,
    0,
  );

  const publicTitles = new Set(
    [...content.upcoming, ...content.archive].map((talk) => talk.title),
  );
  const internalTitles = tableRows(
    fs.readFileSync("details/internal_lab_sessions.md", "utf8"),
    true,
  )
    .map((meeting) => meeting.title)
    .filter((title) => title.length > 20 && !publicTitles.has(title));
  for (const file of files.filter((file) => file.endsWith(".html"))) {
    const $ = html("/" + file);
    assert.equal($('[href*="internal_lab_sessions"]').length, 0, file);
    assert.doesNotMatch(
      $("main").text(),
      /off-weeks|internal mailing list|lab schedule/i,
      file,
    );
    if (file !== "about/index.html")
      assert.equal($("#lab-meetings").length, 0, file);
    for (const title of internalTitles)
      assert.ok(
        !$("body").text().includes(title),
        file + ": internal meeting title",
      );
  }
});
