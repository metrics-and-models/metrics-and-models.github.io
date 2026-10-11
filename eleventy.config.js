import fs from "node:fs";
import { load } from "cheerio";
import { loadContent } from "./lib/content.mjs";

export default function (config) {
  const prefix = (process.env.PATH_PREFIX || "").replace(/\/$/, "");
  config.setNunjucksEnvironmentOptions({ autoescape: true });
  config.addGlobalData("seminars", loadContent);
  config.addGlobalData("site", {
    name: "Metrics and Models",
    description:
      "An open conversation in health and social data science. A seminar series and research community at the University of Oxford.",
    origin: process.env.SITE_URL || "https://metrics-and-models.github.io",
    prefix,
    registration: "https://forms.office.com/e/M3j2M2hBFt",
    subscribe:
      "mailto:sympa@maillist.ox.ac.uk?subject=subscribe%20metrics_and_models",
    email: "metrics_and_models_mgmt@maillist.ox.ac.uk",
  });
  config.addFilter("displayTitle", (title) =>
    /^(TBC|TBD)$/.test(title || "") ? "Title forthcoming" : title,
  );
  config.addFilter("afterFirst", (events) => events.slice(1));
  config.addFilter("initials", (name) =>
    name
      .split(/\s+/)
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join(""),
  );
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
    "assets/logo.png": "assets/oxford-partners.png",
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
