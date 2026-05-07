import { useEffect, useRef, useState } from 'react';
import { RECAL, DEBUG_MODE } from '../constants';

export function useSessionRecorder(currentDb, status, ambientDb, isActive = true) {
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
    startTime: Date.now()
  });

  const [currentSessionState, setCurrentSessionState] = useState({ ...sessionRef.current });
  const [sessionComfortLevel, setSessionComfortLevel] = useState(null);
  const backgroundTimerRef = useRef(null);

  const endSession = () => {
    const session = sessionRef.current;
    if (session.samples.length === 0) return;

    const totalDuration = session.samples.length;
    const voicedSamples = session.samples.filter(s => s.state !== 'silent');
    const voicedDuration = voicedSamples.length;

    // Lowered threshold for easier data accumulation (Total 20s+, Speech 5s+)
    if (voicedDuration >= 5 && totalDuration >= 20) {
      const existingSessions = JSON.parse(localStorage.getItem('vm_sessions') || '[]');
      const newSession = {
        id: session.id,
        startedAt: session.startedAt,
        duration: totalDuration,
        ambientFloor: session.ambientCount > 0 ? session.ambientTotal / session.ambientCount : 40,
        samples: [...session.samples],
        sessionComfortLevel: session.sessionComfortLevel
      };
      
      const updatedSessions = [...existingSessions, newSession].slice(-30);
      localStorage.setItem('vm_sessions', JSON.stringify(updatedSessions));
      if (DEBUG_MODE) console.log("[SESSION] Saved successfully.");
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
      startTime: Date.now()
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

      // Implicit Recalibration Logic
      const sessionElapsed = (Date.now() - session.startTime) / 1000;
      if (!session.recalFinalized && sessionElapsed <= RECAL.WINDOW_SEC) {
        if (sample.state !== 'silent') {
          session.recalSamples.push(sample.db);
          session.recalVoiceSec += 1;

          if (session.recalVoiceSec >= RECAL.MIN_VOICE_SEC) {
            const avg = session.recalSamples.reduce((a, b) => a + b, 0) / session.recalSamples.length;
            session.sessionComfortLevel = avg;
            session.recalFinalized = true;
            setSessionComfortLevel(avg);
            if (DEBUG_MODE) console.log('[RECAL] sessionComfortLevel 확정:', avg.toFixed(1));
          }
        }
      } else if (!session.recalFinalized && sessionElapsed > RECAL.WINDOW_SEC) {
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
    const handleBeforeUnload = () => endSession();
    const handlePageHide = () => endSession();

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
