
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const SOURCE_URL =
  "https://www.gibraltarfa.com/competitions/gibraltar-football-league-26-27-3395567";

async function testFixtureSource() {
  console.log("First Response – Upcoming fixture extraction");
  console.log("Mode: READ ONLY");

  const response = await fetch(SOURCE_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  const carousel = html.match(
    /<ul\b[^>]*class=["'][^"']*\bslides\b[^"']*upcoming-boxes[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
  );

  if (!carousel) {
    throw new Error("Upcoming fixtures carousel not found");
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


  const fixtures = items.map((item) => {
    const content = item[1];

    const date = content.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
    const competition = content.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
    const teams = [...content.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];

    return {
      dateTime: clean(date?.[1]),
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
}

  console.log("READ ONLY – No database changes made.");
}

testFixtureSource().catch((error) => {
  console.error("Fixture extraction failed:", error.message);
  process.exitCode = 1;
});
