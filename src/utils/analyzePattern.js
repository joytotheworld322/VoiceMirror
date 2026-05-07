import { analyzeSession, mean } from './analyzeSession';

export function analyzePattern(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return {
      insufficient: true,
      sessionCount: 0,
      vocalLoadTrend: [],
      lombardTrend: [],
      variabilityTrend: [],
      loadColors: [],
      trendMessage: "insufficient"
    };
  }

  const recentSessions = sessions.slice(-7).map(s => analyzeSession(s));
  const count = recentSessions.length;
  const insufficient = count < 3;

  const vocalLoadTrend = recentSessions.map(s => s.vocalLoadSeconds || 0);
  const variabilityTrend = recentSessions.map(s => s.vocalVariability || 0);
  const lombardTrend = recentSessions.map(s => ({
    ambient: s.ambientFloor || 40,
    lombard: s.lombardRatio || 0
  }));

  const loadColors = recentSessions.map(s => {
    if (s.vocalLoadSeconds > 30) return '#ff3b3b';
    const loudRatio = s.stateRatio?.loud || 0;
    const duration = s.duration || 0;
    if (loudRatio * duration > 60) return '#f5c518';
    return '#4adf84';
  });

  // Trend detection
  let trendMessage = "insufficient";
  if (!insufficient) {
    const last3 = vocalLoadTrend.slice(-3);
    const prev4 = vocalLoadTrend.slice(0, Math.max(0, count - 3));
    const last3Avg = mean(last3);
    const prev4Avg = prev4.length > 0 ? mean(prev4) : last3Avg;
    
    if (last3Avg > prev4Avg + 5) trendMessage = "increasing";
    else if (last3Avg < prev4Avg - 5) trendMessage = "decreasing";
    else trendMessage = "stable";
  }

  return {
    insufficient,
    sessionCount: count,
    vocalLoadTrend,
    lombardTrend,
    variabilityTrend,
    loadColors,
    trendMessage
  };
}
