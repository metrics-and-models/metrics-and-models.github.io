import fs from "node:fs";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { loadContent, withBreaks } from "./lib/content.mjs";

export default function (config) {
  const prefix = (process.env.PATH_PREFIX || "").replace(/\/$/, "");
  let buildTime = new Date(process.env.SITE_NOW || Date.now());
  config.on("eleventy.before", () => {
    buildTime = new Date(process.env.SITE_NOW || Date.now());
    // Eleventy retains removed pages in an existing output directory.
    fs.rmSync("dist/details/internal_lab_sessions.html", { force: true });
    // Keep the canonical github.io site independent of custom-domain redirects.
    fs.rmSync("dist/CNAME", { force: true });
  });
  config.setNunjucksEnvironmentOptions({ autoescape: true });
  config.addGlobalData("seminars", () => loadContent({ now: buildTime }));
  config.addGlobalData("site", {
    name: "Metrics and Models",
    description:
      "Metrics and Models: a University of Oxford lab developing computational methods for complex problems in health and society, with an open seminar series.",
    origin: process.env.SITE_URL || "https://metrics-and-models.github.io",
    prefix,
    production: process.env.SITE_ENV === "production",
    registration: "https://forms.office.com/e/M3j2M2hBFt",
    subscribe:
      "mailto:sympa@maillist.ox.ac.uk?subject=subscribe%20metrics_and_models",
    email: "metrics_and_models_mgmt@maillist.ox.ac.uk",
  });
  config.addFilter("displayTitle", (title) =>
    /^(TBC|TBD)$/.test(title || "") ? "Title forthcoming" : title,
  );
  config.addFilter("monthYear", (iso) =>
    new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso)),
  );
  config.addFilter("pad2", (value) => String(value).padStart(2, "0"));
  config.addFilter("assetVersion", (url) => {
    const version = createHash("sha256")
      .update(fs.readFileSync("site" + url))
      .digest("hex")
      .slice(0, 12);
    return `${url}?v=${version}`;
  });
  config.addFilter("withBreaks", (talks, breaks = []) => withBreaks(talks, breaks, buildTime));
  config.addShortcode("icon", (name, className = "") => {
    if (!/^[a-z-]+$/.test(name)) throw new Error("Invalid icon name");
    return fs
      .readFileSync("node_modules/lucide-static/icons/" + name + ".svg", "utf8")
      .replace(
        "<svg",
        '<svg aria-hidden="true" focusable="false" class="icon ' +
          className +
          '"',
      )
      .replace(/<!--[^]*?-->/g, "");
  });
  config.addTransform("local-links", function (html) {
    if (!this.page.outputPath?.endsWith(".html") || !prefix) return html;
    const $ = load(html);
    $("[href],[src]").each((_, el) => {
      for (const attribute of ["href", "src"]) {
        const value = $(el).attr(attribute);
        if (
          value?.startsWith("/") &&
          !value.startsWith("//") &&
          !value.startsWith(prefix + "/")
        )
          $(el).attr(attribute, prefix + value);
      }
    });
    return $.html();
  });
  config.addPassthroughCopy({
    "site/assets": "assets",
    "assets/metrics_and_models_logo.png": "assets/legacy-logo.png",
  });
  config.addPassthroughCopy({
    "node_modules/@fontsource-variable/instrument-sans/LICENSE":
      "assets/licenses/instrument-sans.txt",
    "node_modules/@fontsource/stix-two-text/LICENSE":
      "assets/licenses/stix-two-text.txt",
    "node_modules/lucide-static/LICENSE": "assets/licenses/lucide.txt",
    "node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2":
      "assets/fonts/instrument-sans.woff2",
    "node_modules/@fontsource/stix-two-text/files/stix-two-text-latin-400-normal.woff2":
      "assets/fonts/stix-two-text.woff2",
    "node_modules/@fontsource/stix-two-text/files/stix-two-text-latin-400-italic.woff2":
      "assets/fonts/stix-two-text-italic.woff2",
  });
  config.addWatchTarget("README.md");
  config.addWatchTarget("details/");
  config.addWatchTarget("lib/");
  return {
    dir: { input: "site", output: "dist" },
    templateFormats: ["njk", "11ty.js"],
    pathPrefix: prefix + "/",
  };
}
