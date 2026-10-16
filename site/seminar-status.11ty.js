export default class {
  data() {
    return {
      permalink: "/seminars/status.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render({ seminars }) {
    return JSON.stringify({
      generatedAt: seminars.generatedAt,
      nextTransitionAt: seminars.nextTransitionAt,
    }, null, 2) + "\n";
  }
}
