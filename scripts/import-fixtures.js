
const SOURCE_URL =
  "https://www.gibraltarfa.com/competitions/gibraltar-football-league-26-27-3395567/matches";

async function testFixtureSource() {
  console.log("First Response – Fixture extraction test");
  console.log("Mode: READ ONLY");

  const response = await fetch(SOURCE_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const matches = [
    ...html.matchAll(/<div\s+class="match"\s*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g)
  ];

  console.log("Match sections detected:", matches.length);

  for (const [index, match] of matches.slice(0, 5).entries()) {
    const text = match[1]
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    console.log(`Match ${index + 1}:`, text);
  }

  console.log("Test complete. No database changes made.");
}

testFixtureSource().catch(error => {
  console.error("Fixture extraction failed:", error.message);
});
