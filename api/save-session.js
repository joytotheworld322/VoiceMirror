import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role key needed for server-side insert
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { userId, session } = body;
    if (!userId || !session) return res.status(400).json({ error: 'Missing data' });

    const samples = session.samples || [];
    const totalSeconds  = samples.length;
    const speechSeconds = samples.filter(s => s.state !== 'silent').length;

    // 저장 조건 미달 시 무시 (최소 15초 유지, 5초 발화)
    if (totalSeconds < 15 || speechSeconds < 5) {
      return res.status(200).json({ skipped: true });
    }


    const ambientFloor = session.ambientCount > 0
      ? session.ambientTotal / session.ambientCount : 40;

    // stateRatio 계산
    const stateCounts = samples.reduce((acc, s) => {
      acc[s.state] = (acc[s.state] || 0) + 1;
      return acc;
    }, {});
    const stateRatio = {
      silent: (stateCounts.silent || 0) / totalSeconds,
      good:   (stateCounts.good   || 0) / totalSeconds,
      loud:   (stateCounts.loud   || 0) / totalSeconds,
      danger: (stateCounts.danger || 0) / totalSeconds,
    };

    const { error } = await supabase.from('sessions').insert({
      user_id:       userId,
      started_at:    session.startedAt,
      duration:      totalSeconds,
      ambient_anchor: ambientFloor,
      state_ratio:   stateRatio,
      vocal_load_seconds: samples.filter(s => s.state === 'danger').length,
      samples,
    });

    if (error) throw error;
    return res.status(200).json({ saved: true });
  } catch (e) {
    console.error('save-session error:', e);
    return res.status(500).json({ error: e.message });
  }
}
