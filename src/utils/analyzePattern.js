import { analyzeSession, mean } from './analyzeSession';

export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

// 이번 주 월요일 00:00 반환 (한국 로컬 기준)
function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay(); // 0=일, 1=월, ..., 6=토
  const diff = day === 0 ? 6 : day - 1; // 월요일 기준
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function analyzeWeekly(rawSessions) {
  const startOfWeek = getStartOfWeek();

  // DB 세션 구조에 맞게 필터링
  const weekSessions = (rawSessions || []).filter(s => {
    const t = s.startedAt || s.started_at;
    return t && new Date(t) >= startOfWeek;
  });

  const weeklyData = Array(7).fill(null).map((_, i) => {
    const daySessions = weekSessions.filter(s => {
      const t = s.startedAt || s.started_at;
      const d = new Date(t);
      const dow = d.getDay();
      const idx = dow === 0 ? 6 : dow - 1;
      return idx === i;
    });

    if (daySessions.length === 0) return null;

    const dangerRatio = mean(daySessions.map(s =>
      s.stateRatio?.danger || s.state_ratio?.danger || 0
    ));
    const vocalLoadSeconds = daySessions.reduce((a, s) =>
      a + (s.vocalLoadSeconds || s.vocal_load_seconds || 0), 0
    );

    return { dangerRatio, vocalLoadSeconds, sessionCount: daySessions.length };
  });

  const validDays = weeklyData
    .map((d, i) => (d ? { ...d, idx: i } : null))
    .filter(Boolean);

  const easiestDay = validDays.length > 0
    ? validDays.reduce((a, b) => a.dangerRatio <= b.dangerRatio ? a : b)
    : null;
  const hardestDay = validDays.length > 0
    ? validDays.reduce((a, b) => a.dangerRatio >= b.dangerRatio ? a : b)
    : null;

  return { weeklyData, validDays, easiestDay, hardestDay };
}

export function analyzePattern(sessions) {
  const { weeklyData } = analyzeWeekly(sessions);
  const validDays = weeklyData
    .map((d, i) => (d ? { ...d, idx: i } : null))
    .filter(Boolean);

  const hardestDay = validDays.length >= 2
    ? validDays.reduce((a, b) => a.dangerRatio > b.dangerRatio ? a : b).idx
    : null;

  const easiestDay = validDays.length >= 2
    ? validDays.reduce((a, b) => a.dangerRatio < b.dangerRatio ? a : b).idx
    : null;

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      insufficient: true,
      sessionCount: 0,
      vocalLoadTrend: [],
      lombardTrend: [],
      variabilityTrend: [],
      loadColors: [],
      trendMessage: 'insufficient',
      hardestDay,
      easiestDay,
    };
  }

  const recentSessions = sessions.slice(-7).map(s => analyzeSession(s));
  const count = recentSessions.length;
  const insufficient = count < 3;

  const vocalLoadTrend = recentSessions.map(s => s.vocalLoadSeconds || 0);
  const variabilityTrend = recentSessions.map(s => s.vocalVariability || 0);
  const lombardTrend = recentSessions.map(s => ({
    ambient: s.ambientFloor || 40,
    lombard: s.lombardRatio || 0,
  }));
  const loadColors = recentSessions.map(s => {
    if (s.vocalLoadSeconds > 30) return '#ff3b3b';
    if ((s.stateRatio?.loud || 0) * (s.duration || 0) > 60) return '#f5c518';
    return '#4adf84';
  });

  let trendMessage = 'insufficient';
  if (!insufficient) {
    const last3 = vocalLoadTrend.slice(-3);
    const prev4 = vocalLoadTrend.slice(0, Math.max(0, count - 3));
    const last3Avg = mean(last3);
    const prev4Avg = prev4.length > 0 ? mean(prev4) : last3Avg;
    if (last3Avg > prev4Avg + 5) trendMessage = 'increasing';
    else if (last3Avg < prev4Avg - 5) trendMessage = 'decreasing';
    else trendMessage = 'stable';
  }

  return { insufficient, sessionCount: count, vocalLoadTrend, lombardTrend, variabilityTrend, loadColors, trendMessage, hardestDay, easiestDay };
}
