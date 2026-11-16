
const SOURCE_URL =
  "https://www.gibraltarfa.com/competitions/gibraltar-football-league-26-27-3395567/matches";

async function testFixtureSource() {
  console.log("First Response — Gibraltar FA fixture import test");
  console.log("Source:", SOURCE_URL);
  console.log("Mode: READ ONLY");
  console.log("No database changes will be made.");

  const response = await fetch(SOURCE_URL);

  if (!response.ok) {
    throw new Error(`Source returned HTTP ${response.status}`);
  }

  const html = await response.text();

  console.log("Page retrieved:", html.length, "characters");
  console.log(
    "Fixture sections found:",
    (html.match(/class="match"/g) || []).length
  );
}

testFixtureSource().catch(error => {
  console.error("Fixture source test failed:", error.message);
});
