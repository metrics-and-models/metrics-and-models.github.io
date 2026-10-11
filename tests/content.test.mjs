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

test("people data is editable and appears without invented filler text", () => {
  const people = JSON.parse(fs.readFileSync("site/_data/people.json", "utf8"));
  const $ = html("/people/index.html");
  assert.equal($(".person").length, people.length);
  for (const person of people) {
    assert.ok(person.name);
    assert.ok(/^https:\/\//.test(person.url));
    assert.ok($(".person h2").text().includes(person.name));
  }
});
