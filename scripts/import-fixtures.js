
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const SOURCE_URL =
  "https://www.gibraltarfa.com/competitions/gibraltar-football-league-26-27-3395567";
const WOMENS_LEAGUE_URL =
  "https://www.gibraltarfa.com/competitions/womens-league-26-27-3396360/matches";

const RESERVE_LEAGUE_URL =
  "https://www.gibraltarfa.com/competitions/reserve-league-26-27-3395742/matches";
const LEAGUES = [
  { name: "Men's League", url: SOURCE_URL },
  { name: "Women's League", url: WOMENS_LEAGUE_URL },
  { name: "Reserve League", url: RESERVE_LEAGUE_URL }
];

async function testFixtureSource() {
  for (const league of LEAGUES) {
  console.log("Processing:", league.name);
  console.log("First Response – Upcoming fixture extraction");
  console.log("Mode: READ ONLY");

const response = await fetch(league.url);
if (response.status === 202) {
  console.log("Security challenge detected for:", league.name);
  continue;
}
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  
console.log("HTTP status:", response.status);
console.log("HTML length:", html.length);
console.log("Contains upcoming-boxes:", html.includes("upcoming-boxes"));
console.log("Page preview:", html.slice(0, 500));

// Women's and Reserve League use a different fixture layout.
// Calendar-based extraction will be added separately.
    const isCalendarLeague = league.name !== "Men's League";
    if (isCalendarLeague) {
  console.log("Calendar fixture layout detected:", league.name);
}
    if (isCalendarLeague) {
  console.log("Calendar match sections:", (html.match(/class=["'][^"']*\bmatch\b[^"']*["']/g) || []).length);
}
  const carousel = html.match(
    /<ul\b[^>]*class=["'][^"']*\bslides\b[^"']*upcoming-boxes[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
  );

  if (!carousel && !isCalendarLeague) {
  console.log("No upcoming fixtures carousel found for:", league.name);
  continue;
}
   
if (isCalendarLeague) {
  console.log("Calendar HTML available:", html.includes("competition-calendar"));
 console.log("Upcoming calendar sample:", html.match(/<div class="match">[\s\S]*?<p class="result">\s*\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}:\d{2}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0]?.slice(0, 2000) || "No upcoming sample found"); 
  console.log("Calendar extraction not yet implemented:", league.name);
  continue;
}
  const items = [...carousel[1].matchAll(
    /<li\b[^>]*class=["'][^"']*\bbox\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
  )];

  
function clean(value) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function parseFixtureDateTime(value) {
  const match = value.match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]+)\s*\|\s*(\d{1,2}):(\d{2})/i
  );

  if (!match) {
    throw new Error(`Unable to parse fixture date: ${value}`);
  }

  const months = [
    "january", "february", "march", "april",
    "may", "june", "july", "august",
    "september", "october", "november", "december"
  ];

  const month = months.indexOf(match[2].toLowerCase());
  if (month === -1) {
    throw new Error(`Unknown fixture month: ${match[2]}`);
  }

 const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();

const seasonStartYear = currentMonth >= 6
  ? currentYear
  : currentYear - 1;

const year = month >= 6
  ? seasonStartYear
  : seasonStartYear + 1;
  const day = match[1].padStart(2, "0");
  const monthNumber = String(month + 1).padStart(2, "0");
  const time = `${match[3].padStart(2, "0")}:${match[4]}:00`;

  return {
    matchDate: `${year}-${monthNumber}-${day}`,
    matchTime: time
  };
}

 const fixtures = items.map((item) => {
    const content = item[1];
const parsedDate = parseFixtureDateTime(clean(content.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1]));
    const date = content.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const competition = content.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
    const teams = [...content.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];

    return {
      dateTime: clean(date?.[1]),
matchDate: parsedDate.matchDate,
matchTime: parsedDate.matchTime,
      competition: clean(competition?.[1]),
      homeTeam: clean(teams[0]?.[1]),
      awayTeam: clean(teams[1]?.[1]),
externalFixtureId: [
  clean(date?.[1]),
  clean(competition?.[1]),
  clean(teams[0]?.[1]),
  clean(teams[1]?.[1])
].join("|")
    };
  });

  const today = new Date().toLocaleDateString("en-CA", {
  timeZone: "Europe/Gibraltar"
});

const futureFixtures = fixtures.filter(fixture =>
  fixture.matchDate >= today
);

console.log("Future fixtures:", futureFixtures.length);
  console.log("Fixtures extracted:", fixtures.length);
  console.log(JSON.stringify(fixtures, null, 2));
  if (!db) {
  console.log("Supabase connection unavailable — comparison skipped.");
} else {
  console.log("Supabase client configured — READ ONLY.");
    const { data: existingFixtures, error } = await db
  .from("fixtures")
  .select("id, home_team, away_team, match_date, match_time, source, external_fixture_id");

if (error) {
  throw new Error(`Supabase fixture query failed: ${error.message}`);
}

console.log("Existing database fixtures:", existingFixtures.length);
console.log(JSON.stringify(existingFixtures, null, 2));
    const existingIds = new Set(
  existingFixtures
    .map(fixture => fixture.external_fixture_id)
    .filter(Boolean)
);

const newFixtures = futureFixtures.filter(fixture => {
  const alreadyExists = existingFixtures.some(existing => {

    const sameExternalId =
      existing.external_fixture_id === fixture.externalFixtureId;

   return sameExternalId && existing.external_fixture_id != null;
  });

  return !alreadyExists;
});

console.log("New fixtures identified:", newFixtures.length);
console.log(JSON.stringify(newFixtures, null, 2));
    const fixturesToImport = newFixtures.map(fixture => ({
  home_team: fixture.homeTeam,
  away_team: fixture.awayTeam,
  match_date: fixture.matchDate,
  match_time: fixture.matchTime,
  source: 'gibraltar_fa',
  external_fixture_id: fixture.externalFixtureId,
  status: 'scheduled',
  is_released: false
}));

console.log("Fixtures prepared for import:", fixturesToImport.length);
    
if (false && fixturesToImport.length > 0) {
  const { data: importedFixtures, error: importError } = await db
    .from("fixtures")
    .upsert(fixturesToImport, {
      onConflict: "source,external_fixture_id",
      ignoreDuplicates: true
    })
    .select("id");

  if (importError) {
    throw new Error("Fixture import failed: " + importError.message);
  }

  console.log("Fixtures imported:", importedFixtures?.length ?? 0);
} else {
  console.log("No new fixtures to import.");
}

}
}
  console.log("Fixture import process completed.");
}

testFixtureSource().catch((error) => {
  console.error("Fixture extraction failed:", error.message);
  process.exitCode = 1;
});
