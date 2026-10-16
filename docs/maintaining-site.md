# Metrics and Models website

The production and development websites are deliberately separate:

| Site | Source | Hosting |
| --- | --- | --- |
| https://metrics-and-models.github.io/ | Original seminar site, after Yang Chen was added (`9506e5b`) | Original repository, `main`, native Jekyll Pages build |
| https://metrics-and-models.ai/ | Rebuilt lab site, maintained on `dev` | Separate `metrics-and-models/dev` repository, `main`, GitHub Actions |

Keep the production repository's Pages custom domain unset. Only the separate
dev repository may use `metrics-and-models.ai`. Do not merge the rebuilt site
into production or redirect the production domain without explicit approval.
The production restoration retains the removal of the internal schedule link
and excludes that schedule from Jekyll publishing.

The `.ai` binding is configured on the dev repository; public availability
still requires GoDaddy DNS and GitHub's HTTPS certificate to be ready.

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

To match the deployed dev site, use `SITE_ENV=preview`,
`SITE_URL=https://metrics-and-models.ai` and an empty `PATH_PREFIX` for all three
commands. These are also the local defaults. The rebuilt site remains unindexed.
The optional `/dev` path-prefix checks can still be run with `PATH_PREFIX=/dev`,
but the custom-domain deployment must not use that prefix.

## Updating content

The existing Markdown is still the source of truth:

- `README.md`: seminar programme table; completed entries are archived automatically in the rebuilt site.
- `details/previous_talks.md`: archive table.
- `details/<speaker>.md`: title, date, institution, abstract, bio and links.

The internal meeting schedule is excluded from both published websites and is
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

`site/assets/field.js` draws illustrative flow, network, distribution and scatter
sketches, not empirical research results. The home page has four sketches sharing
one pause control; People, About and the archive have small heading sketches,
and talk details include a network beside the event facts. Networks rotate and
deform slowly, while coloured points travel along their edges. The
`science-decoration.njk` include provides these smaller versions.

Animation stops when a sketch is offscreen or the tab is hidden. Reduced-motion
preferences initialise all sketches as still images; the controls can start or
pause them. Keep dimensions fixed in CSS and preserve the controls and accessible
canvas labels when adding a sketch.

## Publishing the preview

Source is maintained on `dev` in the original repository. A separate public
`metrics-and-models/dev` repository hosts the preview, receiving the same commit
on its `main` branch. Its Pages setting is **GitHub Actions**.

After committing changes on `dev`:

```sh
git push origin dev
git push preview dev:main
```

The `preview` remote points to `https://github.com/metrics-and-models/dev.git`.
For a fresh clone, add it with
`git remote add preview https://github.com/metrics-and-models/dev.git`.

The workflow can deploy only from `main` in `metrics-and-models/dev`.
Pushing to `origin/dev` runs checks but never changes production. The dev build
uses root-relative links and assets, with `SITE_URL=https://metrics-and-models.ai`
and an empty `PATH_PREFIX`. Search indexing remains disabled. Its custom domain
is set only in the dev repository's Pages settings. The former `/dev/` preview
URL may redirect to `.ai`; the production homepage must not.

## Publishing production

Production remains the original Jekyll site on `main`. Its Pages source is
**Deploy from a branch**, branch `main`, folder `/ (root)`, and the custom-domain
field must stay empty. The rebuild workflow is not part of production.

Do not merge `dev` into `main`: their site implementations now intentionally
differ. Make approved seminar-content updates on `main` and apply the same
content-only changes to `dev` when needed. Do not force-push or discard history.
Preserve `_config.yml`'s exclusion of `details/internal_lab_sessions.md` and keep
the homepage free of internal schedule links or timing information.

## Connecting the GoDaddy domain

The owner has approved `.ai` for the rebuilt dev site only, not a migration of
production. Do not put this domain in the production repository's Pages settings.

DNS is managed at GoDaddy. Keep its existing nameservers and preserve email
records (MX, SPF, DKIM and DMARC), ownership-verification TXT records and other
unrelated records. Do not enable domain forwarding or wildcard DNS.

Before changing the website DNS records, verify ownership under the
[organisation's Pages settings](https://github.com/organizations/metrics-and-models/settings/pages):
add `metrics-and-models.ai`, copy the generated TXT name and value into GoDaddy,
then select Verify. Keep this TXT record permanently. Do not invent the token;
GitHub generates it. See [GitHub's verification instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).

Set only `metrics-and-models/dev`'s Pages custom domain to `metrics-and-models.ai`
before pointing DNS at GitHub. A `CNAME` file is not needed for its Actions-based
Pages build. The dev site is served from the domain root, not `/dev/`.

In GoDaddy's DNS records for `metrics-and-models.ai`, replace the parking A
record(s) for `@` and update the existing `www` CNAME to these values:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | metrics-and-models.github.io |

The `www` CNAME names the GitHub account, not a production-site redirect. GitHub
routes requests for `.ai` to the dev repository that owns the custom-domain
binding; production remains accessible independently at its GitHub URL.

Use GoDaddy's default TTL. Do not retain additional parking A or conflicting
AAAA records at `@`. IPv6 is optional; add it only with the GitHub Pages values
from the [custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

Once DNS is correct and GitHub has issued the certificate, enable **Enforce
HTTPS** on the dev repository. Check the `.ai` homepage, People, talk details,
calendar downloads and internal schedule's 404 response. Verify the original
GitHub homepage still returns HTTP 200 without a redirect, renders the legacy
seminar site and includes Yang Chen. Check the internal schedule is also 404
on production.
Do not report the custom domain as live until DNS and HTTPS have been checked.

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
