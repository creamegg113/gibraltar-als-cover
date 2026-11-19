
const leagues = [
  {
    name: "Women's League",
    url: "https://www.gibraltarfa.com/competitions/womens-league-26-27-3396360"
  },
  {
    name: "Reserve League",
    url: "https://www.gibraltarfa.com/competitions/reserve-league-26-27-3395742"
  }
];

async function testOtherLeagues() {
  for (const league of leagues) {
    console.log("\nChecking:", league.name);

    try {
      const response = await fetch(league.url);
      if (response.status === 202) {
  console.log("Website security challenge detected — skipping this league safely.");
  continue;
}
      const html = await response.text();

      console.log("HTTP status:", response.status);
      console.log("HTML length:", html.length);
      console.log(
  "Calendar HTML sample:",
  html.match(/<div\b[^>]*class=["'][^"']*\bmatch\b[^"']*["'][^>]*>[\s\S]{0,1500}/i)?.[0]
  || "No calendar match found"
);
      console.log("Contains upcoming-boxes:", html.includes("upcoming-boxes"));
      console.log(
  "Calendar match samples:",
  [...html.matchAll(/<div\b[^>]*class=["'][^"']*\bmatch\b[^"']*["'][^>]*>/gi)]
    .slice(0, 3)
    .map(match => html.slice(match.index, match.index + 1500))
);
      const carousel = html.match(
  /<ul\b[^>]*class=["'][^"']*\bslides\b[^"']*upcoming-boxes[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
);

const items = carousel
  ? [...carousel[1].matchAll(
      /<li\b[^>]*class=["'][^"']*\bbox\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
    )]
  : [];

console.log("Fixture cards found:", items.length);
      console.log(
  "Upcoming fixture sections:",
  (html.match(/upcoming-boxes/gi) || []).length
);
      console.log("Dedicated matches page:", league.url + "/matches");
      const calendarResponse = await fetch(league.url + "/matches");
const calendarHtml = await calendarResponse.text();

console.log("Calendar HTTP status:", calendarResponse.status);
console.log(
  "Calendar match sections:",
  (calendarHtml.match(/<div\b[^>]*class=["'][^"']*\bmatch\b[^"']*["'][^>]*>/gi) || []).length
);
console.log("Venue mentioned:", /venue|stadium/i.test(calendarHtml));
      const firstCalendarMatch = calendarHtml.match(
  /<div\b[^>]*class=["'][^"']*\bmatch\b[^"']*["'][^>]*>[\s\S]{0,2000}/i
);

console.log(
  "First calendar match HTML:",
  firstCalendarMatch?.[0] || "No match found"
);

const upcomingCalendarMatch = calendarHtml.match(
  /<div\b[^>]*class=["'][^"']*\bmatch\b[^"']*["'][^>]*>[\s\S]{0,2000}?(?:class=["']time["']|class=["']date["']|class=["']fixture["'])/i
);

console.log(
  "Possible upcoming calendar match:",
  upcomingCalendarMatch?.[0] || "No upcoming match identified"
);
      console.log(
  "Calendar date headings:",
  [...calendarHtml.matchAll(/<h[2-6]\b[^>]*>[\s\S]*?<\/h[2-6]>/gi)]
    .map(m => m[0].replace(/<[^>]+>/g, " ").trim())
    .filter(Boolean)
    .slice(0, 20)
);
      console.log("First fixture card:", items[0]?.[1] || "No fixtures found");
      console.log(
  "All fixture dates:",
  items.map(item =>
    item[1].match(/<h4[^>]*>(.*?)<\/h4>/i)?.[1] || "Date not found"
  )
);

      console.log(
  "Future fixture dates:",
  items
    .map(item =>
      item[1].match(/<h4[^>]*>(.*?)<\/h4>/i)?.[1] || ""
    )
    .filter(date => {
      const match = date.match(
        /\w+\s+(\d+)(?:st|nd|rd|th)\s+(\w+)\s*\|\s*(\d{2}):(\d{2})/i
      );

      if (!match) return false;

      const fixtureDate = new Date(
        `${match[2]} ${match[1]}, 2026 ${match[3]}:${match[4]}`
      );

      return fixtureDate > new Date();
    })
);

      const matches = html.match(/.{0,100}(fixture|match|schedule|competition).{0,100}/gi);

      console.log("Fixture-related HTML samples:");
      console.log(JSON.stringify((matches || []).slice(0, 10), null, 2));

    } catch (error) {
      console.error("Error:", error.message);
    }
  }
}

testOtherLeagues();
