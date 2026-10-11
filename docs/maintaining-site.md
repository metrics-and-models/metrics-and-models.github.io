# Development website

The redesigned website lives on the `dev` branch. The existing production site
and its `main` branch are unchanged. The development preview is published at:

https://metrics-and-models.github.io/dev/

GitHub Pages project sites use an organisation hostname and repository path;
`dev.metrics-models.github.io` is not an assignable Pages hostname. A separate
custom domain can be configured later if desired.

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

## Updating content

The existing Markdown is still the source of truth:

- `README.md`: upcoming talks table.
- `details/previous_talks.md`: archive table.
- `details/internal_lab_sessions.md`: internal sessions table.
- `details/<speaker>.md`: title, date, institution, abstract, bio and links.

Keep each talk's existing `permalink` and the table's details link matching.
Some older files have intentionally different filenames and permalinks; do not
rename their public URLs. Preserve the `Speaker`, `Institution`, `Date`,
`Talk Title`, `Abstract`, and `Bio` labels in detail files. Times must include
GMT or BST and a complete date including year.

To move a talk to the archive, move its table row from `README.md` into
`details/previous_talks.md`. The "Next" label uses the first chronologically
sorted row in the upcoming table; archiving is deliberately manual. Calendar
downloads use the listed GMT/BST offset and assume a one-hour seminar.

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
  "role": "Organising team",
  "affiliation": "",
  "bio": "",
  "photo": ""
}
```

Optional fields can stay empty. For a photo, put the image in
`site/assets/people/` and use `/assets/people/filename.jpg`. Entries without a
photo display as plain names. Entries display in file order. Do not put HTML into fields.
The initial people list comes from the existing site's organising team; no
additional roles, affiliations or biographies have been invented.

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

The workflow tests both repositories but can only deploy from the preview
repository's `main` branch. It cannot replace the production website. It builds
with `/dev` prefixed to local links and assets. Search indexing is disabled in
both HTML metadata and `robots.txt` for this development version.

Promoting the design to production should be a separate, deliberate change:
review/merge the source, adjust the workflow repository and path conditions,
switch production Pages to Actions, and remove the staging robots directives.
Do not change production Pages settings just to preview a development branch.

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
