import { useEffect, useRef, useState } from 'react';
import { RECAL, DEBUG_MODE, AMBIENT_ANCHOR_WINDOW, AMBIENT_DRIFT_LIMIT, LOCAL_STORAGE_KEYS } from '../constants';
import { analyzeSession } from '../utils/analyzeSession';
import { saveSession } from '../lib/sessionService';

const mean = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

export function useSessionRecorder(currentDb, status, ambientDb, isActive = true, userId = null, userComfortLevel = null) {
  const sessionRef = useRef({
    id: Date.now(),
    startedAt: new Date().toISOString(),
    samples: [],
    ambientTotal: 0,
    ambientCount: 0,
    sessionComfortLevel: null,
    recalFinalized: false,
    recalSamples: [],
    recalVoiceSec: 0,
    startTime: Date.now(),
    anchorSamples: [],
    anchorFinalized: false,
    sessionAmbientAnchor: null
  });

  const [currentSessionState, setCurrentSessionState] = useState({ ...sessionRef.current });
  const [sessionComfortLevel, setSessionComfortLevel] = useState(null);
  const backgroundTimerRef = useRef(null);

  const endSession = async () => {
    const session = sessionRef.current;
    if (session.samples.length === 0) return;

    const totalDuration = session.samples.length;
    const voicedSamples = session.samples.filter(s => s.state !== 'silent');
    const voicedDuration = voicedSamples.length;

    const sessionDuration = totalDuration;
    const voicedSeconds = voicedDuration;

    if (DEBUG_MODE) {
      console.log('[SESSION END] duration:', sessionDuration);
      console.log('[SESSION END] voiced seconds:', voicedSeconds);
      console.log('[SESSION END] will save:', sessionDuration >= 60 && voicedSeconds >= 30);
    }

    if (sessionDuration >= 60 && voicedSeconds >= 30 && userId) {
      try {
        const ambientFloor = session.ambientCount > 0 ? session.ambientTotal / session.ambientCount : 40;
        const analysis = analyzeSession({
          ...session,
          ambientFloor,
          duration: totalDuration
        });

        const onboardingComfort = userComfortLevel || parseFloat(localStorage.getItem(LOCAL_STORAGE_KEYS.COMFORTABLE_LEVEL) || '70');

        const sessionData = {
          startedAt:           session.startedAt,
          duration:            totalDuration,
          ambientAnchor:       session.sessionAmbientAnchor || ambientFloor,
          comfortableLevel:    onboardingComfort,
          sessionComfortLevel: session.sessionComfortLevel,
          vocalLoadSeconds:    analysis.vocalLoadSeconds,
          lombardRatio:        analysis.lombardRatio,
          variability:         analysis.vocalVariability,
          stateRatio:          analysis.stateRatio,
          firstHalfAvg:        analysis.halfStats?.firstHalfAvg || 0,
          secondHalfAvg:       analysis.halfStats?.secondHalfAvg || 0,
          samples:             session.samples,
        };

        await saveSession(userId, sessionData);
        if (DEBUG_MODE) console.log('[SESSION END] Supabase 저장 완료');
      } catch (e) {
        console.error('[SESSION END] Supabase 저장 실패:', e);
      }
    }

    // Reset
    const nextSession = {
      id: Date.now(),
      startedAt: new Date().toISOString(),
      samples: [],
      ambientTotal: 0,
      ambientCount: 0,
      sessionComfortLevel: null,
      recalFinalized: false,
      recalSamples: [],
      recalVoiceSec: 0,
      startTime: Date.now(),
      anchorSamples: [],
      anchorFinalized: false,
      sessionAmbientAnchor: null
    };
    sessionRef.current = nextSession;
    setCurrentSessionState({ ...nextSession });
    setSessionComfortLevel(null);
  };

  const latestDataRef = useRef({ currentDb, status, ambientDb });
  
  useEffect(() => {
    latestDataRef.current = { currentDb, status, ambientDb };
  }, [currentDb, status, ambientDb]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const data = latestDataRef.current;
      const session = sessionRef.current;
      
      const sample = {
        t: session.samples.length,
        db: Math.round(data.currentDb),
        state: data.status
      };
      
      session.samples.push(sample);
      session.ambientTotal += data.ambientDb;
      session.ambientCount += 1;

      // Ambient Anchor Logic
      const elapsed = (Date.now() - session.startTime) / 1000;

      if (!session.anchorFinalized && elapsed <= AMBIENT_ANCHOR_WINDOW) {
        if (sample.state === 'silent') {
          session.anchorSamples.push(data.currentDb);
        }
      }

      if (!session.anchorFinalized && elapsed > AMBIENT_ANCHOR_WINDOW) {
        session.anchorFinalized = true;
        session.sessionAmbientAnchor = session.anchorSamples.length > 0
          ? mean(session.anchorSamples)
          : data.ambientDb;
        if (DEBUG_MODE) console.log('[ANCHOR]', session.sessionAmbientAnchor.toFixed(1));
      }

      // Anchor Drift Detection
      if (session.anchorFinalized && session.sessionAmbientAnchor !== null) {
        const drift = Math.abs(data.ambientDb - session.sessionAmbientAnchor);
        if (drift > AMBIENT_DRIFT_LIMIT) {
          session.sessionAmbientAnchor = data.ambientDb;
          // Reset recalibration
          session.recalSamples = [];
          session.recalVoiceSec = 0;
          session.recalFinalized = false;
          session.sessionComfortLevel = null;
          setSessionComfortLevel(null);
          if (DEBUG_MODE) console.log('[ANCHOR DRIFT] 환경 변화 감지, anchor 업데이트');
        }
      }

      // Implicit Recalibration Logic
      if (!session.recalFinalized && elapsed <= RECAL.WINDOW_SEC) {
        if (sample.state !== 'silent') {
          session.recalSamples.push(sample.db);
          session.recalVoiceSec += 1;

          if (session.recalVoiceSec >= RECAL.MIN_VOICE_SEC) {
            const avg = mean(session.recalSamples);
            session.sessionComfortLevel = avg;
            session.recalFinalized = true;
            setSessionComfortLevel(avg);
            if (DEBUG_MODE) console.log('[RECAL] sessionComfortLevel 확정:', avg.toFixed(1));
          }
        }
      } else if (!session.recalFinalized && elapsed > RECAL.WINDOW_SEC) {
        session.recalFinalized = true;
        if (DEBUG_MODE) console.log('[RECAL] 시간 초과, 온보딩 값 fallback');
      }
      
      setCurrentSessionState({ 
        ...session,
        samples: [...session.samples]
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundTimerRef.current = setTimeout(() => endSession(), 5 * 60 * 1000);
      } else if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    };
    const handleBeforeUnload = () => { endSession(); };
    const handlePageHide = () => { endSession(); };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  return { currentSession: currentSessionState, sessionComfortLevel }; 
}
