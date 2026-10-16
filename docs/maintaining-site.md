# Metrics and Models website

The canonical repository is
[`metrics-and-models/metrics-and-models.github.io`](https://github.com/metrics-and-models/metrics-and-models.github.io).
It contains the rebuilt lab site and the retained seminar content. The `main`
branch deploys the site through GitHub Actions to
https://metrics-and-models.github.io/.

Keep the repository's Pages custom-domain field empty and do not add a `CNAME`
file. The GitHub URL must serve the website directly, without redirecting to
`metrics-and-models.ai`. There is one canonical source repository and one
production branch; the former separate `metrics-and-models/dev` repository is
no longer a publishing target.

## Local preview and checks

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open http://localhost:8081/. To use another port: `npm run dev -- --port=8082`.

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

`CHROME_PATH=/usr/bin/google-chrome npm run test:browser` uses an installed Chrome.
The browser suite checks five desktop, tablet and mobile widths, every talk detail page,
archive filtering, navigation, calendars, images and animation behaviour.

Local builds default to `SITE_URL=https://metrics-and-models.github.io` and an
empty `PATH_PREFIX`. They remain unindexed unless `SITE_ENV=production` is set:
preview pages have `noindex` metadata and `robots.txt` disallows crawling.
GitHub Actions sets `SITE_ENV=production` for the production build.

For an explicit production-build check, use `SITE_ENV=production npm run build`
and `SITE_ENV=production npm test`. Optional path-prefix checks can still use
`PATH_PREFIX=/dev`, but the production deployment uses an empty prefix.

## Updating content

The existing Markdown is still the source of truth:

- `README.md`: seminar programme table; completed entries are archived automatically in the rebuilt site.
- `details/previous_talks.md`: archive table.
- `details/<speaker>.md`: title, date, institution, abstract, bio and links.

The internal meeting schedule is excluded from the published website and is
not loaded into template data. About contains only a brief mention of lab
meetings, with no dates, cadence or schedule link. The build also removes the
old generated schedule page from an existing `dist/` directory. Do not restore
that page or copy the source schedule into published assets. The existing
Markdown and public Git history are retained; this is not a confidentiality
guarantee for information already published.

Keep each talk's existing `permalink` and the table's details link matching.
Some older files have intentionally different filenames and permalinks; do not
rename their public URLs. Preserve the `Speaker`, `Institution`, `Date`,
`Talk Title`, `Abstract`, and `Bio` labels in detail files. Times must include
GMT or BST and a complete date including year.

The rebuilt site moves each programme entry into Previous talks when its
scheduled one-hour slot ends, using the listed GMT/BST offset. This updates
the next-talk links, homepage cards, archive filters and talk-page attendance
links together. It does not rewrite the Markdown tables. You can leave
completed rows in `README.md`; entries already in `details/previous_talks.md`
remain historical, and a URL briefly present in both tables is displayed once.
Undated entries remain upcoming until a complete date is supplied. Talk URLs
and calendar downloads stay available after archiving. When no future talks
remain, the site shows an announcement message and retains the archive.

GitHub Actions checks hourly whether the published `/seminars/status.json`
has reached its next transition, and rebuilds only when needed. The existing
Monday publication refresh also rebuilds the site. Scheduled Actions can run
late, so public updates follow the next successful scheduled deployment rather
than an exact second. GitHub disables schedules after 60 days without repository
activity; re-enable the workflow if that happens. Local preview builds apply
the same date rules whenever the site rebuilds. `SITE_NOW` can fix the build
clock for checking future states, for example
`SITE_NOW=2030-01-01T00:00:00Z npm run build`; omit it for normal use.

Planned breaks are listed in `site/_data/seminarBreaks.json`. They appear in
date order alongside talks, but do not count as seminars, receive a "Next"
label, or generate calendar invitations. Breaks before the current UK date
are omitted when the site rebuilds.

Historical source inconsistencies have not been silently corrected: the archive
and detail files disagree on the time zones of Mathew Zook and Weisi Guo, and
several old archive rows use BST outside the summer period. Review those source
dates separately before treating the archive as authoritative calendar data.

## Adding people

Edit `site/_data/people.json`. Add an object following this structure:

```json
{
  "name": "Full name",
  "url": "https://example.org/",
  "urlLabel": "Website",
  "role": "Lab member",
  "interests": ["Research interest", "Another research interest"],
  "bio": "",
  "photo": "",
  "links": []
}
```

Use the same "Lab member" role for everyone. Keep profiles minimal; keywords are
preferred to long biographies. Only publish information intended for the public
profile, not the correspondence in which it was supplied.

The homepage URL, interests, short bio, photo and extra links are optional and
can stay empty. For a photo, put the approved image in
`site/assets/people/` and use `/assets/people/filename.jpg`. Entries without a
photo display as plain names. The primary URL appears beneath the research
interests, labelled by `urlLabel` (default: "Website"). Extra links
use objects such as `{"label": "Google Scholar", "url": "https://..."}`.
Entries display in file order, currently alphabetical by given name. Do not put
HTML into fields. Existing members remain listed when new profiles are added.

Profile sources and portrait provenance are recorded in
`docs/people-sources.md`. Use "Mingyue Liu" as supplied, even though her linked
departmental page uses "Rita Liu".

## Scientific sketches

`site/assets/field.js` draws illustrative mathematical sketches. The home page
has one subtle 3D Gaussian surface that moves slowly and fades into the header,
with a pause control. Inner pages retain their existing heading plots, chosen
from network, distribution, scatter, heatmap, time-series and contour sketches.
These are decorative illustrations rather than empirical research results.

Animation stops when a sketch is offscreen or the tab is hidden. Reduced-motion
preferences show the sketches immediately as still images; the controls can
start or pause them. Keep dimensions fixed in CSS and preserve the controls
and accessible canvas labels when adding a sketch.

## Publishing

Maintain changes in the canonical repository and merge them into `main`. An
`origin` remote used for publishing must point to
`https://github.com/metrics-and-models/metrics-and-models.github.io.git`.
After the intended changes are committed on `main`, publish with:

```sh
git push origin main
```

Pull requests run checks; deployment is restricted to the canonical repository's
`main` branch. Do not maintain a second copy of content or push to the former
`dev` repository to publish the site. Preserve existing Git history and talk
URLs when making changes.

In the canonical repository's **Settings → Pages**, use **GitHub Actions** as
the source and keep the custom-domain field empty. The workflow builds the
Eleventy site into `dist/`, runs content and browser checks, uploads the Pages
artifact and deploys it. Production uses:

```text
SITE_ENV=production
SITE_URL=https://metrics-and-models.github.io
PATH_PREFIX=
```

The retained Jekyll source files are not a separate deployment pipeline. Keep
`details/internal_lab_sessions.md` excluded from publishing and the homepage
free of internal schedule links or timing information. Do not add a `CNAME`
file to the source or generated output.

After deployment, check that https://metrics-and-models.github.io/ serves the
rebuilt homepage directly over HTTPS, with no redirect to `.ai`. Check People,
seminars, previous talks, talk details and calendar downloads, and confirm the
internal schedule URL returns 404.

## The `.ai` domain

The owner requires both https://metrics-and-models.github.io/ and
https://metrics-and-models.ai/ to serve the website. The GitHub URL must never
redirect to `.ai`. Keep the canonical repository's Pages custom-domain field
empty and do not add a `CNAME` file: attaching `.ai` there would redirect the
GitHub Pages URL to the custom domain. See [GitHub's custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages).

The `.ai` domain remains on its current `metrics-and-models/dev` deployment
during the transition. Its replacement must use an external host deploying
from the same canonical `metrics-and-models.github.io` repository and `main`
branch. Vercel has been suggested, but it is not connected or configured yet.
Do not retire the old `dev` deployment or remove its domain binding until the
replacement `.ai` deployment has been verified.

Before completing the transition, verify `.ai` over HTTPS, including People,
seminars, talk details and calendar downloads, and confirm the GitHub URL still
serves the site directly. Domain changes must preserve the existing nameservers,
email records (MX, SPF, DKIM and DMARC), verification TXT records and unrelated
DNS records. Record the replacement host and deployment arrangement here once
implemented and verified.

## Dependencies and security

The published site is static HTML, CSS, JavaScript, images, icons and self-hosted
fonts. npm dependencies only execute at build/test time; no npm package code or
server runtime is deployed to visitors. All content is trusted repository data.

At initial development, `npm audit` reported unpatched denial-of-service issues
in Eleventy's build-only dependency chains (`braces` and `sprintf-js`). The
suggested forced fix would downgrade Eleventy to an incompatible old release;
it has not been applied. Recheck advisories when updating dependencies. Do not
expose the development server publicly or build untrusted content with secrets.

Font and icon licences are in `docs/third-party-notices.md`.
