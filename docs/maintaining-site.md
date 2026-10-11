# Metrics and Models website

The rebuilt lab website is prepared for https://metrics-and-models.ai/.
Production is published from `main` in `metrics-and-models.github.io`; `dev`
remains the working branch. The separate preview repository is published at:

https://metrics-and-models.github.io/dev/

Once the custom domain is connected to the organisation site, GitHub Pages
redirects the old URLs to the new domain, including the preview at
https://metrics-and-models.ai/dev/. No additional DNS record is needed for `/dev/`.

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

To test the deployed path locally, stop the existing server first, then run
`PATH_PREFIX=/dev npm run build`, `PATH_PREFIX=/dev npm test` and
`PATH_PREFIX=/dev npm run test:browser`.

For the production configuration, use `SITE_ENV=production`,
`SITE_URL=https://metrics-and-models.ai` and an empty `PATH_PREFIX` for all three
commands. Local builds default to preview mode and remain unindexed.

## Updating content

The existing Markdown is still the source of truth:

- `README.md`: upcoming talks table.
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

To move a talk to the archive, move its table row from `README.md` into
`details/previous_talks.md`. The "Next" label uses the first chronologically
sorted row in the upcoming table; archiving is deliberately manual. Calendar
downloads use the listed GMT/BST offset and assume a one-hour seminar.

Planned breaks are listed in `seminarBreaks` in the front matter of
`site/index.njk`. They appear in date order alongside talks, but do not count as
seminars, receive a "Next" label, or generate calendar invitations. Remove a
break from that list once it is no longer part of the upcoming programme.

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

The workflow can deploy only from `main` in either of these two repositories.
Pushing to `origin/dev` runs checks but never changes production. The preview
build uses `/dev` for local links and assets; search indexing remains disabled.

## Publishing production

After reviewing and testing changes on `dev`, merge them into `main` and push
`origin/main`. Do not force-push or replace unrelated content changes. The
production repository's Pages publishing source must be **GitHub Actions**;
its `github-pages` environment permits only `main` to deploy.

Production builds set `SITE_ENV=production`, `SITE_URL=https://metrics-and-models.ai`
and an empty `PATH_PREFIX`. This generates root-relative assets, canonical URLs
and calendar links for the new domain. Existing event UIDs and talk permalinks
are preserved. Production allows search indexing, except for `/dev/` and the
404 page.

## Connecting the GoDaddy domain

DNS is managed at GoDaddy. Keep its existing nameservers and preserve email
records (MX, SPF, DKIM and DMARC), ownership-verification TXT records and other
unrelated records. Do not enable domain forwarding or wildcard DNS.

Before changing the website DNS records, verify ownership under the
[organisation's Pages settings](https://github.com/organizations/metrics-and-models/settings/pages):
add `metrics-and-models.ai`, copy the generated TXT name and value into GoDaddy,
then select Verify. Keep this TXT record permanently. Do not invent the token;
GitHub generates it. See [GitHub's verification instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).

Coordinate the domain switch with the DNS update: set the production repository's
Pages custom domain to `metrics-and-models.ai` before pointing DNS at GitHub.
That setting starts redirecting the old site, so do not leave a long gap before
updating DNS. A `CNAME` file is not needed for an Actions-based Pages site.

In GoDaddy's DNS records for `metrics-and-models.ai`, replace the parking A
record(s) for `@` and update the existing `www` CNAME to these values:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | metrics-and-models.github.io |

Use GoDaddy's default TTL. Do not retain additional parking A or conflicting
AAAA records at `@`. IPv6 is optional; add it only with the GitHub Pages values
from the [custom-domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

Once DNS is correct and GitHub has issued the certificate, enable **Enforce
HTTPS**. Check the apex domain, `www` redirect, old GitHub URLs, `/dev/`, talk
detail pages, calendar downloads and the internal schedule's 404 response.
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
