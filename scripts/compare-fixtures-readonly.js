// Read-only comparison: does not insert, update, delete or release any fixtures.
// Potential removals are deliberately NOT classified as cancellations.
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase comparison secrets'); process.exit(1); }
const snapshot = JSON.parse(fs.readFileSync('fixture-monitor-output/snapshot.json', 'utf8'));
if (snapshot.status !== 'success' || snapshot.leagues.length !== 3) {
  throw new Error('Incomplete source snapshot; comparison refused');
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pairKey = m => norm(m.home || m.home_team) + '|' + norm(m.away || m.away_team);
async function run() {
  const existing = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('fixtures')
      .select('id,home_team,away_team,match_date,match_time,status,is_released,assigned_staff_id,source,external_fixture_id')
      .range(offset, offset + 999).order('id');
    if (error) throw new Error('Read-only fixture query failed: ' + error.message);
    existing.push(...data);
    if (data.length < 1000) break;
  }
  const index = new Map();
  for (const row of existing) {
    const k = pairKey(row);
    index.set(k, [...(index.get(k) || []), row]);
  }
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Gibraltar' });
  const proposals = [];
  let scheduledCount = 0;
  for (const league of snapshot.leagues) {
    for (const match of league.matches) {
      if (match.status !== 'scheduled' || !match.date || match.date < today) continue;
      scheduledCount++;
      const candidates = index.get(pairKey(match)) || [];
      const source = { league: league.id, home: match.home, away: match.away, date: match.date, time: match.time };
      if (!candidates.length) {
        proposals.push({ type: 'possible_new_fixture', source, note: 'Review before adding; team names may differ in Supabase' });
        continue;
      }
      // Multiple same-team fixtures can exist across dates or competitions.
      // Do not select an arbitrary record and overwrite its assignment.
      const exact = candidates.find(row => row.match_date === match.date && String(row.match_time || '').slice(0,5) === match.time);
      if (exact) continue;
      if (candidates.length !== 1) {
        proposals.push({ type: 'ambiguous_match', source, candidateFixtureIds: candidates.map(r => r.id) });
        continue;
      }
      const row = candidates[0];
      proposals.push({ type: 'possible_reschedule', source,
        existing: { id: row.id, date: row.match_date, time: String(row.match_time || '').slice(0,5),
          status: row.status, released: row.is_released, assigned: row.assigned_staff_id != null },
        note: 'Review manually; no changes made' });
    }
  }
  const report = { checkedAt: snapshot.checkedAt, comparedAt: new Date().toISOString(),
    sourceScheduledFixtures: scheduledCount, existingFixtureCount: existing.length,
    proposals, counts: proposals.reduce((acc,p) => (acc[p.type] = (acc[p.type] || 0) + 1, acc), {}),
    warnings: ['No automatic cancellations or removals', 'No venue comparison: source calendar lacks venues',
      'Team-pair matching is provisional; repeated fixtures and naming differences require administrator review',
      'Manual overrides and assignment safety not yet enforced by database constraints'] };
  fs.writeFileSync('fixture-monitor-output/comparison.json', JSON.stringify(report,null,2));
  console.log('READ ONLY: existing fixtures:', existing.length, 'upcoming source fixtures:', scheduledCount);
  console.log('Review candidates:', JSON.stringify(report.counts));
  console.log('No Supabase changes made.');
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });
