
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
      const html = await response.text();

      console.log("HTTP status:", response.status);
      console.log("HTML length:", html.length);
      console.log("Contains upcoming-boxes:", html.includes("upcoming-boxes"));
      const carousel = html.match(
  /<ul\b[^>]*class=["'][^"']*\bslides\b[^"']*upcoming-boxes[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
);

const items = carousel
  ? [...carousel[1].matchAll(
      /<li\b[^>]*class=["'][^"']*\bbox\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
    )]
  : [];

console.log("Fixture cards found:", items.length);
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
