import { calendarEvent } from "../lib/content.mjs";
export default class {
  data() {
    return { pagination: { data: "seminars.calendarTalks", size: 1, alias: "event" },
      permalink: data => data.event.calendar || false, eleventyExcludeFromCollections: true };
  }
  render(data) { return calendarEvent(data.event, data.site.origin, data.site.prefix); }
}
