import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import {
  loadContent,
  parseDate,
  calendarEvent,
  tableRows,
} from "../lib/content.mjs";

const content = loadContent();
const prefix = (process.env.PATH_PREFIX || "").replace(/\/$/, "");
const html = (url) => load(fs.readFileSync("dist" + url, "utf8"));

test("all source schedule rows and detail permalinks survive the rebuild", () => {
  for (const [source, key] of [
    ["README.md", "upcoming"],
    ["details/previous_talks.md", "archive"],
    ["details/internal_lab_sessions.md", "internal"],
  ]) {
    const rows = tableRows(fs.readFileSync(source, "utf8"), key === "internal");
    assert.equal(content[key].length, rows.length);
    for (const row of rows) {
      const event = content[key].find(
        (event) =>
          event.speaker === row.speaker && event.date.label === row.date.label,
      );
      assert.ok(event, row.speaker);
      assert.equal(event.title, row.title);
      assert.equal(event.url, row.url);
    }
  }
  for (const event of [...content.upcoming, ...content.archive]) {
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

test("the homepage lists each talk once and marks the next seminar", () => {
  const $ = html("/index.html");
  assert.equal($(".talk-row").length, content.upcoming.length);
  const first = $(".talk-row").first();
  assert.ok(first.text().includes(content.next.speaker));
  assert.ok(first.text().includes(content.next.title));
  assert.equal(first.find("h3 a").attr("href"), prefix + content.next.url);
  assert.equal($(".next-marker").length, 1);
  assert.equal(first.find(".next-marker").text(), "Next");
});

test("Christmas Eve is a break in the programme, not a seminar", () => {
  const $ = html("/index.html");
  const notice = $(".programme-break");
  assert.equal(notice.length, 1);
  assert.equal(notice.find("time").attr("datetime"), "2026-12-24");
  assert.match(notice.text(), /No seminar/);
  assert.equal(notice.find("h3").text(), "Silent night. Silent Zoom.");
  assert.match(notice.find(".break-message").text(), /Christmas Eve/);
  assert.match(notice.prev().text(), /Ilya Kashnitsky/);
  assert.match(notice.next().text(), /Yang Chen/);
  assert.equal(notice.find("a, button, .next-marker").length, 0);
  assert.ok(
    content.upcoming.every((talk) => !talk.date.iso.startsWith("2026-12-24")),
  );
  assert.equal(fs.readdirSync("dist/calendar").length, content.upcoming.length);
  assert.equal(
    html("/details/previous_talks.html")(".programme-break").length,
    0,
  );
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
  for (const event of content.upcoming) {
    const ics = fs.readFileSync("dist" + event.calendar, "utf8");
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
    const unfolded = ics.replace(/\r\n /g, "");
    assert.ok(
      unfolded.includes(
        "DTSTART:" + event.date.iso.replace(/[-:]/g, "").replace(".000", ""),
      ),
    );
    assert.ok(
      unfolded.includes(
        "URL:https://metrics-and-models.github.io" + prefix + event.url,
      ),
    );
    for (const line of ics.split("\r\n"))
      assert.ok(Buffer.byteLength(line) <= 75);
  }
  const escaped = calendarEvent({
    ...content.next,
    title: "Data, models;\nand " + "é".repeat(100),
  }).replace(/\r\n /g, "");
  assert.ok(escaped.includes("Data\\, models\\;\\nand "));
});

test("all generated internal links, fragments and assets resolve, including the deployment prefix", () => {
  const files = fs
    .readdirSync("dist", { recursive: true })
    .filter((file) => file.endsWith(".html"));
  for (const file of files) {
    const $ = html("/" + file);
    assert.equal($('meta[name="robots"]').attr("content"), "noindex, nofollow");
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
    assert.equal(profile.find(".person-role").text(), "Lab member");
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
  assert.match(
    home(".intro-copy").text(),
    /lab for health and social data science/,
  );
  assert.equal(home(".intro-copy a").first().attr("href"), prefix + "/people/");
  assert.equal(home("#upcoming h2").text(), "Open seminars");
  assert.match(home(".programme-intro").text(), /open to everyone/);
  assert.match(about("main").text(), /flat structure/);
  assert.match(about("#join").text(), /do not need to be a lab member/);
});
