import { supabase } from './supabase';

// 세션 저장
export async function saveSession(userId, sessionData) {
  const {
    startedAt, duration, ambientAnchor, comfortableLevel,
    sessionComfortLevel, vocalLoadSeconds, lombardRatio,
    variability, stateRatio, firstHalfAvg, secondHalfAvg, samples,
  } = sessionData;

  const { error } = await supabase
    .from('sessions')
    .insert({
      user_id:              userId,
      started_at:           startedAt,
      duration,
      ambient_anchor:       ambientAnchor,
      comfortable_level:    comfortableLevel,
      session_comfort_level: sessionComfortLevel,
      vocal_load_seconds:   vocalLoadSeconds,
      lombard_ratio:        lombardRatio,
      variability,
      state_ratio:          stateRatio,
      first_half_avg:       firstHalfAvg,
      second_half_avg:      secondHalfAvg,
      samples,
    });

  if (error) throw error;
}

// 최근 세션 불러오기
export async function getRecentSessions(userId, limit = 30) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// 세션 총 개수
export async function getSessionCount(userId) {
  const { count, error } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count;
}

// 모든 세션 삭제
export async function deleteAllSessions(userId) {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}
