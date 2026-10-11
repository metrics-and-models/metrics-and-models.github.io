import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import matter from "gray-matter";
import { load } from "cheerio";

const markdown = new MarkdownIt({ html: true, linkify: true });
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function parseDate(label) {
  const match = label
    .replaceAll("*", "")
    .match(
      /(\d{1,2}):(\d{2})\s+(GMT|BST),?\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),?\s+(\d{4})/,
    );
  if (!match)
    return {
      label,
      iso: "",
      year: "",
      day: "",
      month: "",
      time: "",
      full: label,
    };
  const [, hour, minute, zone, day, month, year] = match;
  const monthIndex = months.indexOf(month);
  if (monthIndex === -1) throw new Error("Unrecognised date: " + label);
  const date = new Date(
    Date.UTC(
      +year,
      monthIndex,
      +day,
      +hour - (zone === "BST" ? 1 : 0),
      +minute,
    ),
  );
  return {
    label,
    iso: date.toISOString(),
    day: day.padStart(2, "0"),
    month: month.slice(0, 3),
    year,
    time: hour + ":" + minute + " " + zone,
    full: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(date),
  };
}

function readDetail(file) {
  const { content, data } = matter(fs.readFileSync(file, "utf8"));
  const $ = load(markdown.render(content), null, false);
  const heading = (name) =>
    $("h2,h3")
      .filter((_, el) =>
        $(el)
          .text()
          .startsWith(name + ":"),
      )
      .first()
      .text()
      .replace(name + ":", "")
      .trim();
  const speaker = heading("Speaker");
  const institution = heading("Institution");
  const date = parseDate(heading("Date"));
  let title = "";
  $("p").each((_, el) => {
    const strong = $(el).children("strong").first();
    const label = strong.text().replace(/:$/, "");
    if (label === "Talk Title") {
      strong.remove();
      title = $(el).text().replace(/^:\s*/, "").trim();
      $(el).remove();
    } else if (["Abstract", "Bio", "Biography", "Paper"].includes(label)) {
      strong.remove();
      const textNode = $(el).contents().first();
      if (textNode[0]?.type === "text")
        textNode[0].data = textNode[0].data.replace(/^:\s*/, "");
      $(el).before("<h2>" + (label === "Bio" ? "Biography" : label) + "</h2>");
    }
  });
  $("h2,h3")
    .filter((_, el) => /^(Speaker|Institution|Date|Role):/.test($(el).text()))
    .remove();
  return {
    speaker,
    institution,
    date,
    title,
    body: $.html(),
    url: data.permalink || "/details/" + path.basename(file, ".md") + ".html",
    source: file,
  };
}

export function tableRows(source, internal = false) {
  const $ = load(markdown.render(source));
  return $("table tbody tr")
    .toArray()
    .map((row) => {
      const cells = $(row).children("td");
      if (cells.length < 4) return null;
      return {
        speaker: cells.eq(0).text().trim(),
        home: cells.eq(0).find("a").attr("href") || "",
        date: parseDate(cells.eq(1).text().trim()),
        title: cells.eq(2).text().trim(),
        url: internal ? "" : cells.eq(3).find("a").attr("href") || "",
        mode: internal ? cells.eq(3).text().trim() : "Online",
      };
    })
    .filter(Boolean);
}

export function loadContent() {
  const details = fs
    .readdirSync("details")
    .filter(
      (name) =>
        name.endsWith(".md") &&
        !["previous_talks.md", "internal_lab_sessions.md"].includes(name),
    )
    .map((name) => readDetail(path.join("details", name)));
  const byUrl = new Map(details.map((talk) => [talk.url, talk]));
  const attach = (talk, archived) => {
    const detail = byUrl.get(talk.url);
    return {
      ...talk,
      institution: detail?.institution || "",
      archived,
      cancelled: talk.speaker.startsWith("CANCELLED "),
      calendar: talk.date.iso
        ? "/calendar/" + path.basename(talk.url, ".html") + ".ics"
        : "",
    };
  };
  const upcoming = tableRows(fs.readFileSync("README.md", "utf8"))
    .map((t) => attach(t, false))
    .sort((a, b) => a.date.iso.localeCompare(b.date.iso));
  const archive = tableRows(
    fs.readFileSync("details/previous_talks.md", "utf8"),
  )
    .map((t) => attach(t, true))
    .sort((a, b) => b.date.iso.localeCompare(a.date.iso));
  for (const detail of details) {
    const event = [...upcoming, ...archive].find((t) => t.url === detail.url);
    if (event)
      Object.assign(detail, {
        home: event.home,
        archived: event.archived,
        cancelled: event.cancelled,
        calendar: event.calendar,
      });
  }
  return {
    upcoming,
    archive,
    details,
    next: upcoming[0],
    total: upcoming.length + archive.length,
    years: [...new Set(archive.map((t) => t.date.year))],
  };
}

export function calendarEvent(
  talk,
  origin = "https://metrics-and-models.github.io",
  prefix = "",
) {
  const escape = (s) =>
    s
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;");
  const stamp = (value) => value.replace(/[-:]/g, "").replace(".000", "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Metrics and Models//Seminars//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + path.basename(talk.url, ".html") + "@metrics-and-models.github.io",
    "DTSTAMP:" + stamp(talk.date.iso),
    "DTSTART:" + stamp(talk.date.iso),
    "DURATION:PT1H",
    "SUMMARY:" + escape(talk.speaker + ": " + talk.title),
    "DESCRIPTION:" +
      escape(
        "Metrics and Models seminar. Registration and joining information: " +
          origin +
          prefix +
          "/about/#join",
      ),
    "URL:" + origin + prefix + talk.url,
    "LOCATION:Online",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Fold at UTF-8 octet boundaries, as required by the iCalendar format.
  return (
    lines
      .map((line) => {
        let result = "",
          row = "",
          size = 0;
        for (const char of line) {
          const bytes = Buffer.byteLength(char);
          if (size + bytes > 73) {
            result += row + "\r\n";
            row = " ";
            size = 1;
          }
          row += char;
          size += bytes;
        }
        return result + row;
      })
      .join("\r\n") + "\r\n"
  );
}
