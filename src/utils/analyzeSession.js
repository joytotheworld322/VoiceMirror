import { VOCAL_STRAIN_ABS } from '../constants';

export function mean(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdDev(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

export function analyzeSession(session) {
  if (!session || !session.samples || session.samples.length === 0) {
    return {
      id: session?.id || Date.now(),
      stateRatio: { silent: 1, good: 0, loud: 0, danger: 0 },
      avgVoicedDb: 0,
      lombardRatio: 0,
      vocalLoadSeconds: 0,
      vocalVariability: 0,
      duration: session?.duration || 0,
      startedAt: session?.startedAt || new Date().toISOString(),
      ambientFloor: session?.ambientFloor || 40,
      halfStats: null,
      ambientLevel: "normal"
    };
  }

  const { samples, ambientFloor, duration, startedAt } = session;
  
  // [호환성 처리] 샘플이 객체가 아닌 숫자라면 임시 객체로 변환
  const normalizedSamples = samples.map(s => {
    if (typeof s === 'number') {
      // 과거 데이터는 상태 정보가 없으므로 음량 기준으로 대략적 판정
      let state = 'silent';
      if (s > (ambientFloor + 8)) state = 'good';
      if (s >= 85) state = 'danger';
      return { db: s, state };
    }
    return s;
  });

  const total = normalizedSamples.length;
  const stateCounts = normalizedSamples.reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1;
    return acc;
  }, {});

  const stateRatio = {
    silent: (stateCounts.silent || 0) / total,
    good: (stateCounts.good || 0) / total,
    loud: (stateCounts.loud || 0) / total,
    danger: (stateCounts.danger || 0) / total,
  };

  const voicedSamples = normalizedSamples.filter(s => s && s.state !== 'silent').map(s => s.db);
  const avgVoicedDb = mean(voicedSamples);
  const lombardRatio = avgVoicedDb > 0 ? Math.max(0, avgVoicedDb - ambientFloor) : 0;
  
  const vocalLoadSeconds = normalizedSamples.filter(s => s.state === 'danger' && s.db >= VOCAL_STRAIN_ABS).length;
  const vocalVariability = stdDev(voicedSamples);

  const halfIdx = Math.floor(normalizedSamples.length / 2);
  const firstHalfSamples = normalizedSamples.slice(0, halfIdx);
  const secondHalfSamples = normalizedSamples.slice(halfIdx);
  const firstHalfVoiced = firstHalfSamples.filter(s => s && s.state !== 'silent').map(s => s.db);
  const secondHalfVoiced = secondHalfSamples.filter(s => s && s.state !== 'silent').map(s => s.db);
  
  const firstHalfAvg = mean(firstHalfVoiced);
  const secondHalfAvg = mean(secondHalfVoiced);

  const getCounts = (list) => list.reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1;
    return acc;
  }, {});

  let ambientLevel = "normal";
  if (ambientFloor < 40) ambientLevel = "quiet";
  else if (ambientFloor < 55) ambientLevel = "normal";
  else if (ambientFloor < 65) ambientLevel = "somewhat_loud";
  else ambientLevel = "loud";

  return {
    id: session.id,
    stateRatio,
    avgVoicedDb,
    lombardRatio,
    vocalLoadSeconds,
    vocalVariability,
    duration: duration || total,
    startedAt,
    ambientFloor,
    halfStats: {
      firstHalfAvg,
      secondHalfAvg,
      halfDiff: secondHalfAvg - firstHalfAvg,
      firstHalfState: getCounts(firstHalfSamples),
      secondHalfState: getCounts(secondHalfSamples)
    },
    ambientLevel,
    sessionComfortLevel: session.sessionComfortLevel || null
  };
}
