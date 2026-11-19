
const url = "https://comet-demo.gibraltarfa.com/dlink?p=dHlwZT1UWVBFX01BVENILGlkPTM0MDYxMDg%3D";

async function testComet() {
  console.log("First Response - COMET connection test");
  console.log("Mode: READ ONLY");
  console.log("Match ID: 3406108");

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });

    console.log("HTTP status:", response.status);
    console.log("Final URL:", response.url);
    console.log("Content type:", response.headers.get("content-type"));

    const html = await response.text();
    console.log("Response length:", html.length);
    console.log("Page title:", html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "Not found");
    console.log("Venue mentioned:", /Lathbury Barracks/i.test(html));
    console.log("Match ID mentioned:", html.includes("3406108"));
    console.log("Response preview:", html.slice(0, 300));
  } catch (error) {
    console.log("Connection failed:", error.message);
  }
}

testComet();
