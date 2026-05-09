import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { getUserProfile } from './lib/userService';
import { saveSession } from './lib/sessionService';
import { signInWithGoogle } from './lib/authService';
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

// 세션 저장 최소 조건 (테스트 및 실제 사용성 개선을 위해 기준 대폭 완화)
const MIN_SESSION_DURATION = 15;   // 전체 세션 길이 >= 15초
const MIN_SPEECH_DURATION   = 5;   // 발화 감지 시간 >= 5초


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
  const authTokenRef      = useRef(null);

  // ── Viewport Height Fix for iOS ──────────────────────────
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);

  // ── 1. Auth 세션 관리 ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      authTokenRef.current = session?.access_token || null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      authTokenRef.current = session?.access_token || null;
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

    // 1순위: 프로필이 아예 없거나 닉네임이 설정되지 않은 경우
    if (!profile || !profile.nickname) {
      if (onboardingStep !== 'nickname') setOnboardingStep('nickname');
      return;
    }

    // 2순위: 오늘의 주변 소음 측정이 되지 않은 경우 (목소리 측정 중이 아닐 때)
    if (!isDailyAmbientDone && onboardingStep !== 'voice') {
      if (onboardingStep !== 'ambient') setOnboardingStep('ambient');
      return;
    }

    // 3순위: 최초 목소리 보정(comfortable_level)이 없는 경우
    if (profile.comfortable_level === null && onboardingStep !== 'voice') {
      if (onboardingStep !== 'voice') setOnboardingStep('voice');
      return;
    }

    // 모든 조건 충족 시 온보딩 모드 해제
    if (onboardingStep !== null) setOnboardingStep(null);
  }, [profile, isDailyAmbientDone, loading, session, onboardingStep]);

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
          if (snap && snap.samples.length >= MIN_SESSION_DURATION) {
            await trySaveSession(snap);
            setCurrentSession(null);
            currentSessionRef.current = null;
          }
        }, 10 * 1000); // 10초로 대폭 단축 (PWA/모바일 최적화)


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

      const uid = userIdRef.current;
      if (!uid) return;

      const analysis = analyzeSession({
        ...snap,
        duration: snap.samples.length,
        ambientFloor: snap.ambientCount > 0 ? snap.ambientTotal / snap.ambientCount : 40,
      });

      const payload = {
        user_id: uid,
        started_at: snap.startedAt,
        duration: snap.samples.length,
        ambient_anchor: analysis.ambientFloor,
        comfortable_level: profileRef.current?.comfortable_level || null,
        session_comfort_level: null,
        vocal_load_seconds: analysis.vocalLoadSeconds,
        lombard_ratio: analysis.lombardRatio,
        variability: analysis.vocalVariability,
        state_ratio: analysis.stateRatio,
        first_half_avg: analysis.halfStats?.firstHalfAvg || null,
        second_half_avg: analysis.halfStats?.secondHalfAvg || null,
        samples: snap.samples,
      };

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const token = authTokenRef.current || supabaseKey;

      // pagehide/beforeunload 시 직접 Supabase REST API 호출 (로컬 개발 환경 호환)
      fetch(`${supabaseUrl}/rest/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload),
        keepalive: true
      });
    };

    window.addEventListener('pagehide', handleUnload); // 모바일 사파리에서는 beforeunload보다 pagehide가 더 권장됨
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  // ── 9. 인사이트 진입 시 자동 저장 트리거 ────────────────
  useEffect(() => {
    if (view === 'insight' && currentSessionRef.current) {
      const snap = currentSessionRef.current;
      if (snap.samples.length >= MIN_SESSION_DURATION) {
        trySaveSession(snap).then(() => {
          setCurrentSession(null);
          currentSessionRef.current = null;
        });
      }
    }
  }, [view, trySaveSession]);


  // ─────────────────────────────────────────────────────────
  if (loading) return <div className="loading-screen">VOICEMIRROR</div>;

  if (!session) {
    return <LandingView onLogin={signInWithGoogle} />;
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
        nickname={profile?.nickname}
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
