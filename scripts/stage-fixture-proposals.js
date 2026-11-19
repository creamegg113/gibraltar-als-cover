// Stage review candidates only. Never write to public.fixtures.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const report = JSON.parse(fs.readFileSync('fixture-monitor-output/comparison.json', 'utf8'));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
async function main() {
  let added = 0, existing = 0;
  for (const p of report.proposals) {
    const s = p.source;
    if (!['possible_new_fixture','possible_reschedule','ambiguous_match'].includes(p.type)) continue;
    const key = crypto.createHash('sha256').update(JSON.stringify([p.type,s.league,s.home,s.away,s.date,s.time,p.existing?.id || null])).digest('hex');
    const { data: old, error: readError } = await db.from('fixture_proposals').select('id,review_status')
      .eq('proposal_key',key).maybeSingle();
    if (readError) throw readError;
    if (old) {
      // Preserve approved/rejected decisions; only update last-seen timestamp.
      const { error } = await db.from('fixture_proposals').update({last_seen_at:new Date().toISOString()}).eq('id',old.id);
      if (error) throw error;
      existing++; continue;
    }
    const { error } = await db.from('fixture_proposals').insert({
      proposal_key:key,proposal_type:p.type,league:s.league,home_team:s.home,away_team:s.away,
      proposed_date:s.date,proposed_time:s.time,existing_fixture_id:p.existing?.id || null
    });
    if (error) throw error;
    added++;
  }
  console.log('Staged for admin review:',added,'already recorded:',existing,'; live fixtures untouched.');
}
main().catch(e => {console.error(e.message);process.exitCode=1;});
