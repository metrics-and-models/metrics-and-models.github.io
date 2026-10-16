// Hourly Actions runs use the published status to avoid rebuilding between talks.
// Missing or invalid status must trigger a build so the site can repair itself.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function timestamp(value) {
  if (typeof value !== "string") return NaN;
  const parsed = Date.parse(value);
  // The status endpoint uses Date.toISOString(); reject partial or rolled dates.
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed
    : NaN;
}

export function needsSeminarRefresh(status, now = Date.now()) {
  const generated = timestamp(status?.generatedAt);
  if (!Number.isFinite(generated) || generated > Number(now)) return true;
  if (status.nextTransitionAt === null) return false;
  const next = timestamp(status.nextTransitionAt);
  return !Number.isFinite(next) || next <= Number(now);
}

async function main() {
  let rebuild = true;
  try {
    const url = new URL(
      "/seminars/status.json",
      process.env.SITE_URL || "https://metrics-and-models.github.io",
    );
    url.searchParams.set("checkedAt", String(Date.now()));
    const response = await fetch(url, {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    rebuild = needsSeminarRefresh(await response.json());
    console.log(
      rebuild
        ? "Seminar schedule is due or its status needs repair; rebuilding."
        : "No seminar schedule transition is due; skipping this hourly build.",
    );
  } catch (error) {
    console.warn("Could not check the live seminar schedule; rebuilding:", error.message);
  }
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `rebuild=${rebuild}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
