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
  
  const total = samples.length;
  const stateCounts = samples.reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1;
    return acc;
  }, {});

  const stateRatio = {
    silent: (stateCounts.silent || 0) / total,
    good: (stateCounts.good || 0) / total,
    loud: (stateCounts.loud || 0) / total,
    danger: (stateCounts.danger || 0) / total,
  };

  const voicedSamples = samples.filter(s => s && s.state !== 'silent').map(s => s.db);
  const avgVoicedDb = mean(voicedSamples);
  const lombardRatio = avgVoicedDb > 0 ? Math.max(0, avgVoicedDb - ambientFloor) : 0;
  
  // Revised Vocal Load: State is danger AND dB >= 85
  const vocalLoadSeconds = samples.filter(s => s.state === 'danger' && s.db >= VOCAL_STRAIN_ABS).length;
  
  const vocalVariability = stdDev(voicedSamples);

  // First half vs Second half comparison
  const halfIdx = Math.floor(samples.length / 2);
  const firstHalfSamples = samples.slice(0, halfIdx);
  const secondHalfSamples = samples.slice(halfIdx);
  
  const firstHalfVoiced = firstHalfSamples.filter(s => s && s.state !== 'silent').map(s => s.db);
  const secondHalfVoiced = secondHalfSamples.filter(s => s && s.state !== 'silent').map(s => s.db);
  
  const firstHalfAvg = mean(firstHalfVoiced);
  const secondHalfAvg = mean(secondHalfVoiced);

  // Dominant states for coloring
  const getCounts = (list) => list.reduce((acc, s) => {
    acc[s.state] = (acc[s.state] || 0) + 1;
    return acc;
  }, {});

  // Environment level
  let ambientLevel = "normal";
  if (ambientFloor < 45) ambientLevel = "quiet";
  else if (ambientFloor > 60) ambientLevel = "loud";

  return {
    id: session.id,
    stateRatio,
    avgVoicedDb,
    lombardRatio,
    vocalLoadSeconds,
    vocalVariability,
    duration,
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
