// First Response: read-only Gibraltar FA fixture monitoring via Browserless BrowserQL.
// No Supabase connection or database writes. Node 20+.
const fs = require('node:fs');
const token = process.env.BROWSERLESS_API_KEY;
if (!token) { console.error('Missing BROWSERLESS_API_KEY secret'); process.exit(1); }
const endpoint = process.env.BROWSERLESS_BQL_ENDPOINT || 'https://production-sfo.browserless.io/chromium/bql';
const leagues = [
  { id: 'mens', name: "Men's League", url: 'https://www.gibraltarfa.com/competitions/gibraltar-football-league-26-27-3395567/matches' },
  { id: 'womens', name: "Women's League", url: 'https://www.gibraltarfa.com/competitions/womens-league-26-27-3396360/matches' },
  { id: 'reserves', name: 'Reserve League', url: 'https://www.gibraltarfa.com/competitions/reserve-league-26-27-3395742/matches' }
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const extraction = `JSON.stringify(Array.from(document.querySelectorAll('.competition-calendar')).map(section => ({
  matchday: section.querySelector('h4')?.innerText.trim() || '',
  matches: Array.from(section.querySelectorAll('.match')).map(match => ({
    home: match.querySelector('.team:first-child')?.innerText.trim() || '',
    away: match.querySelector('.team:last-child')?.innerText.trim() || '',
    details: match.querySelector('.information')?.innerText.trim() || ''
  }))
})))`;
function queryFor(url) {
  return `mutation FirstResponseFixtures {
    goto(url: ${JSON.stringify(url)}, waitUntil: domContentLoaded) { status }
    evaluate(content: ${JSON.stringify(extraction)}) { value }
  }`;
}
async function getLeague(league) {
  const res = await fetch(endpoint + '?token=' + encodeURIComponent(token), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: queryFor(league.url), operationName: 'FirstResponseFixtures' }),
    signal: AbortSignal.timeout(90000)
  });
  if (!res.ok) throw new Error('Browserless HTTP ' + res.status);
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '));
  if (body.data?.goto?.status !== 200) throw new Error('Gibraltar FA returned HTTP ' + body.data?.goto?.status);
  const groups = JSON.parse(body.data?.evaluate?.value || 'null');
  if (!Array.isArray(groups) || !groups.length) throw new Error('No matchdays returned');
  const matches = groups.flatMap(group => (group.matches || []).map(m => {
    if (!m.home || !m.away || !m.details) throw new Error('Incomplete match data');
    const scheduled = m.details.match(/^(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s*-\\s*(\\d{2}:\\d{2})$/);
    return { league: league.id, matchday: group.matchday, home: m.home, away: m.away,
      sourceDetails: m.details, status: scheduled ? 'scheduled' : 'other',
      date: scheduled ? `${scheduled[3]}-${scheduled[2]}-${scheduled[1]}` : null,
      time: scheduled ? scheduled[4] : null };
  }));
  if (!matches.length) throw new Error('No matches returned');
  return { id: league.id, name: league.name, sourceUrl: league.url, matchdays: groups.length, count: matches.length, matches };
}
(async () => {
  const output = { checkedAt: new Date().toISOString(), status: 'incomplete', leagues: [], failures: [] };
  for (const league of leagues) {
    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await getLeague(league);
        output.leagues.push(result);
        console.log(`${league.name}: ${result.matchdays} matchdays, ${result.count} matches (attempt ${attempt})`);
        success = true; break;
      } catch (e) {
        console.error(`${league.name} attempt ${attempt}: ${e.message}`);
        if (attempt < 3) await sleep(attempt * 10000);
        else output.failures.push({ league: league.id, error: e.message });
      }
    }
    if (!success) console.error(`${league.name}: no verified snapshot; do not treat missing fixtures as cancellations`);
  }
  output.status = output.failures.length ? 'incomplete' : 'success';
  fs.mkdirSync('fixture-monitor-output', { recursive: true });
  fs.writeFileSync('fixture-monitor-output/snapshot.json', JSON.stringify(output, null, 2));
  console.log('Saved fixture-monitor-output/snapshot.json; status:', output.status);
  if (output.failures.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
