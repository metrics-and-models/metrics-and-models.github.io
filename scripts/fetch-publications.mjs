// Refreshes site/_data/publications.json with lab members' latest journal
// articles from OpenAlex. Members are looked up by `orcid` and/or `openalex`
// (one author ID or a list, since OpenAlex sometimes splits a person across
// profiles) in site/_data/people.json. Run with `npm run publications`.
import fs from "node:fs";

const people = JSON.parse(fs.readFileSync("site/_data/people.json", "utf8"));
const since = new Date();
since.setFullYear(since.getFullYear() - 2);
const contact = "metrics_and_models_mgmt@maillist.ox.ac.uk";

const normalise = (name) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
const members = people.map((person) => ({
  name: person.name,
  orcid: person.orcid?.replace(/^https?:\/\/orcid\.org\//, ""),
  ids: [person.openalex].flat().filter(Boolean),
  key: normalise(person.name),
}));

// Credits every lab member listed on a work, whichever profile they appear
// under, so co-authored papers name all of the lab's authors.
function labAuthors(work) {
  const found = new Set();
  for (const { author } of work.authorships) {
    const id = author.id?.split("/").pop();
    const orcid = author.orcid?.split("/").pop();
    const key = normalise(author.display_name || "");
    for (const member of members)
      if (
        (orcid && orcid === member.orcid) ||
        member.ids.includes(id) ||
        key === member.key
      )
        found.add(member.name);
  }
  return people.map((p) => p.name).filter((name) => found.has(name));
}

const works = new Map();
for (const member of members) {
  const filters = [];
  if (member.orcid) filters.push("author.orcid:" + member.orcid);
  if (member.ids.length) filters.push("author.id:" + member.ids.join("|"));
  for (const author of filters) {
    const url = new URL("https://api.openalex.org/works");
    url.search = new URLSearchParams({
      filter: [
        author,
        "type:article",
        "from_publication_date:" + since.toISOString().slice(0, 10),
      ].join(","),
      sort: "publication_date:desc",
      "per-page": "15",
      mailto: contact,
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(member.name + ": " + response.status);
    for (const work of (await response.json()).results) {
      const source = work.primary_location?.source;
      // Published journal articles only, not preprints or repository copies.
      if (source?.type !== "journal" || !work.title || works.has(work.id))
        continue;
      works.set(work.id, {
        title: work.title.replace(/<[^>]+>/g, ""),
        date: work.publication_date,
        year: work.publication_year,
        journal: source.display_name,
        url: work.doi || work.primary_location.landing_page_url || work.id,
        authors: work.authorships.length,
        members: labAuthors(work),
      });
    }
  }
}

const publications = [...works.values()]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 12);
fs.writeFileSync(
  "site/_data/publications.json",
  JSON.stringify(publications, null, 2) + "\n",
);
console.log("Saved " + publications.length + " publications.");
