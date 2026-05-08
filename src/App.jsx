import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { getUserProfile } from './lib/userService';
import { saveSession } from './lib/sessionService';
import { analyzeSession } from './utils/analyzeSession';
import useAudioAnalyzer from './useAudioAnalyzer';
import LandingView from './views/LandingView';
import OnboardingNickname from './views/OnboardingNickname';
import OnboardingAmbient from './views/OnboardingAmbient';
import OnboardingVoice from './views/OnboardingVoice';
import MainView from './views/MainView';
import SettingsView from './views/SettingsView';
import InsightView from './views/InsightView';
import './App.css';

// 세션 저장 최소 조건
const MIN_SESSION_DURATION = 60;   // 전체 세션 길이 >= 60초
const MIN_SPEECH_DURATION   = 30;  // 발화 감지 시간 >= 30초

function App() {
  const [session, setSession]               = useState(null);
  const [profile, setProfile]               = useState(null);
  const [loading, setLoading]               = useState(true);
  const [view, setView]                     = useState('main');
  const [onboardingStep, setOnboardingStep] = useState(null);
  const [tempAmbient, setTempAmbient]       = useState(null);
  const [isDailyAmbientDone, setIsDailyAmbientDone] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [isAppActive, setIsAppActive] = useState(true); // 앱 활성 상태 관리

  // 세션 데이터를 ref에도 병렬 저장 → beforeunload에서 최신값 참조용
  const currentSessionRef = useRef(null);
  const bgTimerRef        = useRef(null);
  const userIdRef         = useRef(null);
  const profileRef        = useRef(null);

  // ── 1. Auth 세션 관리 ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setProfile(null);
        setIsDailyAmbientDone(false);
        setOnboardingStep(null);
        setLoading(false);
        setCurrentSession(null);
        currentSessionRef.current = null;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── 2. 프로필 로딩 ────────────────────────────────────────
  const loadProfile = useCallback(async (uid) => {
    try {
      const data = await getUserProfile(uid);
      setProfile(data);
      profileRef.current = data;
    } catch (err) {
      console.error('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      userIdRef.current = session.user.id;
      loadProfile(session.user.id);
    }
  }, [session]);

  // ── 3. 온보딩 단계 결정 ───────────────────────────────────
  useEffect(() => {
    if (loading || !session) return;
    if (profile && !profile.nickname) { setOnboardingStep('nickname'); return; }
    if (!isDailyAmbientDone && onboardingStep !== 'voice') { setOnboardingStep('ambient'); return; }
    if (profile && profile.comfortable_level === null && onboardingStep !== 'voice') { setOnboardingStep('voice'); return; }
  }, [profile, isDailyAmbientDone, loading, session]);

  // ── 4. personalizedLevels ────────────────────────────────
  const personalizedLevels = useMemo(() => {
    if (onboardingStep !== null || !profile) return null;
    const base = tempAmbient || profile.ambient_baseline || 40;
    return { ambient: base, comfortable: profile.comfortable_level || (base + 15) };
  }, [profile, onboardingStep, tempAmbient]);

  // 앱이 활성 상태일 때만 오디오 분석기 가동
  const { status, currentDb, ambientDb, isVoiceLike } = useAudioAnalyzer(personalizedLevels, null, isAppActive);

  // 실시간 오디오 값 추적용 Ref (타이머 리셋 방지)
  const liveAudioRef = useRef({ db: 40, status: 'silent', ambient: 40 });

  useEffect(() => {
    liveAudioRef.current = { db: currentDb, status, ambient: ambientDb };
  }, [currentDb, status, ambientDb]);

  // ── 5. 실시간 세션 샘플 수집 (MainView 활성 시만) ────────
  useEffect(() => {
    if (view !== 'main' || onboardingStep !== null || !session) return;

    if (!currentSession) {
      const newSession = {
        samples: [],
        startedAt: new Date().toISOString(),
        ambientTotal: 0,
        ambientCount: 0,
      };
      setCurrentSession(newSession);
      currentSessionRef.current = newSession;
    }

    const interval = setInterval(() => {
      const { db, status, ambient } = liveAudioRef.current;
      setCurrentSession(prev => {
        if (!prev) return prev;
        const next = {
          ...prev,
          samples: [...prev.samples, { db, state: status }],
          ambientTotal: prev.ambientTotal + ambient,
          ambientCount: prev.ambientCount + 1,
        };
        currentSessionRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [view, onboardingStep, !!session]); // 오디오 값 변화에는 리셋되지 않음

  // ── 6. 세션 저장 함수 ────────────────────────────────────
  const trySaveSession = useCallback(async (sessionData) => {
    const uid = userIdRef.current;
    if (!uid || !sessionData) return;

    const totalSeconds    = sessionData.samples.length; // 1샘플=1초
    const speechSeconds   = sessionData.samples.filter(s => s.state !== 'silent').length;

    // 저장 조건 검사
    if (totalSeconds < MIN_SESSION_DURATION || speechSeconds < MIN_SPEECH_DURATION) {
      console.log(`세션 저장 스킵 — 전체:${totalSeconds}s 발화:${speechSeconds}s`);
      return;
    }

    const analysis = analyzeSession({
      ...sessionData,
      duration: totalSeconds,
      ambientFloor: sessionData.ambientCount > 0
        ? sessionData.ambientTotal / sessionData.ambientCount : 40,
    });

    try {
      await saveSession(uid, {
        startedAt:           sessionData.startedAt,
        duration:            totalSeconds,
        ambientAnchor:       analysis.ambientFloor,
        comfortableLevel:    profileRef.current?.comfortable_level || null,
        sessionComfortLevel: null,
        vocalLoadSeconds:    analysis.vocalLoadSeconds,
        lombardRatio:        analysis.lombardRatio,
        variability:         analysis.vocalVariability,
        stateRatio:          analysis.stateRatio,
        firstHalfAvg:        analysis.halfStats?.firstHalfAvg || null,
        secondHalfAvg:       analysis.halfStats?.secondHalfAvg || null,
        samples:             sessionData.samples,
      });
      console.log('세션 저장 완료 ✓');
    } catch (e) {
      console.error('세션 저장 실패:', e);
    }
  }, []);

  // ── 7. 세션 종료 및 앱 상태 처리 ───────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setIsAppActive(false); // 마이크 끄기
        bgTimerRef.current = setTimeout(async () => {
          const snap = currentSessionRef.current;
          await trySaveSession(snap);
          setCurrentSession(null);
          currentSessionRef.current = null;
        }, 3 * 60 * 1000); // 테스트 편의를 위해 3분으로 단축
      } else {
        setIsAppActive(true); // 마이크 다시 켜기
        if (bgTimerRef.current) {
          clearTimeout(bgTimerRef.current);
          bgTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [trySaveSession]);

  // ── 8. 세션 종료 조건 B — 앱 완전 종료 (beforeunload) ───
  useEffect(() => {
    const handleUnload = () => {
      const snap = currentSessionRef.current;
      if (!snap || snap.samples.length < MIN_SESSION_DURATION) return;
      const speechSeconds = snap.samples.filter(s => s.state !== 'silent').length;
      if (speechSeconds < MIN_SPEECH_DURATION) return;

      // navigator.sendBeacon으로 비동기 전송 (beforeunload에서 fetch 불가)
      const uid = userIdRef.current;
      if (!uid) return;
      const payload = JSON.stringify({ userId: uid, session: snap });
      navigator.sendBeacon('/api/save-session', payload);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // ─────────────────────────────────────────────────────────
  if (loading) return <div className="loading-screen">VOICEMIRROR</div>;

  if (!session) {
    return <LandingView onLogin={() => supabase.auth.signInWithOAuth({ provider: 'google' })} />;
  }

  if (onboardingStep === 'nickname') {
    return <OnboardingNickname userId={session.user.id} onComplete={() => loadProfile(session.user.id)} />;
  }
  if (onboardingStep === 'ambient') {
    return (
      <OnboardingAmbient
        userId={session.user.id}
        currentDb={currentDb}
        onComplete={(measuredAmbient) => {
          setTempAmbient(measuredAmbient);
          setIsDailyAmbientDone(true);
          setOnboardingStep(null);
        }}
      />
    );
  }
  if (onboardingStep === 'voice') {
    return (
      <OnboardingVoice
        userId={session.user.id}
        currentDb={currentDb}
        ambientDb={tempAmbient || 40}
        isVoiceLike={isVoiceLike}
        onBack={() => setOnboardingStep(null)}
        onComplete={() => { setOnboardingStep(null); loadProfile(session.user.id); }}
      />
    );
  }

  // ── Insight 탭: 세션 일시정지 (종료 아님) ────────────────
  if (view === 'insight') {
    return (
      <InsightView
        userId={session.user.id}
        currentSession={currentSession}  // 현재 세션 데이터 그대로 전달
        onBack={() => setView('main')}   // 복귀 시 같은 세션 계속
      />
    );
  }

  if (view === 'settings') {
    return (
      <SettingsView
        user={session.user}
        profile={profile}
        onBack={() => setView('main')}
        onLogout={() => supabase.auth.signOut()}
        onProfileUpdate={() => loadProfile(session.user.id)}
        onRecalibrate={() => setOnboardingStep('voice')}
      />
    );
  }

  return (
    <MainView
      status={status}
      currentDb={currentDb}
      ambientDb={ambientDb}
      user={profile}
      onNavigateToInsight={() => setView('insight')}
      onSettings={() => setView('settings')}
    />
  );
}

export default App;
