import { useRef, useEffect, useState, useMemo } from 'react';
import './App.css';
import { useAudioAnalyzer } from './useAudioAnalyzer';
import { LOCAL_STORAGE_KEYS, ONBOARDING_VOICE_MIN } from './constants';
import MainView from './views/MainView';
import InsightView from './views/InsightView';
import SettingsView from './views/SettingsView';
import BreathCanvas from './components/BreathCanvas';
import { useSessionRecorder } from './hooks/useSessionRecorder';
import { getOrCreateUser } from './lib/userService';

export default function App() {
  const [view, setView] = useState('main'); // main | insight | settings
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [onboardingStep, setOnboardingStep] = useState(() => {
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.NICKNAME)) return 'nickname';
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.ONBOARDING_COMPLETE)) return 'ambient';
    return 'ambient'; // Always run ambient check on launch
  });

  const [isAmbientStarted, setIsAmbientStarted] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    ambientBaseline: null,
    comfortableLevel: null,
  });
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [nicknameInput, setNicknameInput] = useState('');

  // User Initialization
  useEffect(() => {
    async function initUser() {
      const nickname = localStorage.getItem(LOCAL_STORAGE_KEYS.NICKNAME);
      if (nickname) {
        try {
          const u = await getOrCreateUser(nickname);
          setUser(u);
        } catch (e) {
          console.error('유저 초기화 실패:', e);
        }
      }
      setLoadingUser(false);
    }
    initUser();
  }, []);

  const personalizedLevels = useMemo(() => {
    if (onboardingStep !== null) return null;
    const ambient = localStorage.getItem(LOCAL_STORAGE_KEYS.AMBIENT_BASELINE);
    const comfort = localStorage.getItem(LOCAL_STORAGE_KEYS.COMFORTABLE_LEVEL);
    if (ambient && comfort) {
      return {
        ambientBaseline: parseFloat(ambient),
        comfortableLevel: parseFloat(comfort),
      };
    }
    return null;
  }, [onboardingStep]);

  const [bridgeComfortLevel, setBridgeComfortLevel] = useState(null);

  const { status, currentDb, ambientDb, permissionState, isVoiceLike } = useAudioAnalyzer(personalizedLevels, bridgeComfortLevel);
  
  const { currentSession, sessionComfortLevel } = useSessionRecorder(
    currentDb, 
    status, 
    ambientDb, 
    onboardingStep === null && view === 'main',
    user?.id
  );

  useEffect(() => {
    if (sessionComfortLevel !== bridgeComfortLevel) {
      setBridgeComfortLevel(sessionComfortLevel);
    }
  }, [sessionComfortLevel]);

  const latestDbRef = useRef(currentDb);
  useEffect(() => {
    latestDbRef.current = currentDb;
  }, [currentDb]);

  const latestVoiceLikeRef = useRef(isVoiceLike);
  useEffect(() => {
    latestVoiceLikeRef.current = isVoiceLike;
  }, [isVoiceLike]);

  // Onboarding sequence
  useEffect(() => {
    if (onboardingStep === 'ambient' && isAmbientStarted) {
      const duration = 5000;
      const start = Date.now();
      const samples = [];
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        setCountdown(Math.min(100, (elapsed / duration) * 100));
        samples.push(latestDbRef.current);
        
        if (elapsed >= duration) {
          clearInterval(interval);
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          setOnboardingData(prev => ({ ...prev, ambientBaseline: avg }));
          
          const savedComfort = localStorage.getItem(LOCAL_STORAGE_KEYS.COMFORTABLE_LEVEL);
          if (savedComfort) {
            localStorage.setItem(LOCAL_STORAGE_KEYS.AMBIENT_BASELINE, avg);
            setOnboardingStep(null);
          } else {
            setOnboardingStep('speech');
          }
        }
      }, 50);
      return () => clearInterval(interval);
    }

    if (onboardingStep === 'speech') {
      const duration = 10000;
      const start = Date.now();
      const speechSamples = [];
      setCountdown(0);
      setErrorMsg(null);
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        setCountdown(Math.min(100, (elapsed / duration) * 100));
        
        const db = latestDbRef.current;
        const voiceLike = latestVoiceLikeRef.current;
        if (db > ONBOARDING_VOICE_MIN && voiceLike) {
          speechSamples.push(db);
        }
        
        if (elapsed >= duration) {
          clearInterval(interval);
          if (speechSamples.length < 60) {
            setErrorMsg('발화가 너무 짧아요. 다시 시도해주세요.');
            setTimeout(() => {
              setOnboardingStep('speech_retry');
            }, 1500);
          } else {
            const avg = speechSamples.reduce((a, b) => a + b, 0) / speechSamples.length;
            setOnboardingData(prev => ({ ...prev, comfortableLevel: avg }));
            setOnboardingStep('complete');
          }
        }
      }, 50);
      return () => clearInterval(interval);
    }

    if (onboardingStep === 'speech_retry') {
      setOnboardingStep('speech');
    }

    if (onboardingStep === 'complete') {
      localStorage.setItem(LOCAL_STORAGE_KEYS.AMBIENT_BASELINE, onboardingData.ambientBaseline);
      localStorage.setItem(LOCAL_STORAGE_KEYS.COMFORTABLE_LEVEL, onboardingData.comfortableLevel);
      localStorage.setItem(LOCAL_STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
      
      async function finalInit() {
        const nickname = localStorage.getItem(LOCAL_STORAGE_KEYS.NICKNAME);
        const u = await getOrCreateUser(nickname);
        setUser(u);
        setOnboardingStep(null);
      }
      finalInit();
    }
  }, [onboardingStep, onboardingData.ambientBaseline, isAmbientStarted]);

  const handleNicknameSubmit = (e) => {
    if (e) e.preventDefault();
    if (nicknameInput.trim()) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.NICKNAME, nicknameInput.trim());
      setOnboardingStep('ambient');
    }
  };

  if (permissionState === 'denied') {
    return (
      <div className="denied-screen">
        <p className="denied-title">마이크 권한이 필요해요</p>
        <p className="denied-desc">
          브라우저 설정에서 이 사이트의 마이크 접근을 허용한 뒤 새로고침해 주세요.
        </p>
      </div>
    );
  }

  // Loading Splash
  if (loadingUser && onboardingStep === null) {
    return (
      <div className="app loading-splash">
        <BreathCanvas status="silent" />
      </div>
    );
  }

  // Onboarding UI
  if (onboardingStep !== null) {
    if (onboardingStep === 'nickname') {
      return (
        <div className="app onboarding-step0">
          <div className="nickname-step">
            <p className="onboarding-guide">당신을 어떻게 부를까요?</p>
            <form onSubmit={handleNicknameSubmit}>
              <input 
                type="text" 
                className="nickname-input"
                placeholder="이름 또는 닉네임"
                maxLength={10}
                autoFocus
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
              />
              <button 
                type="submit" 
                className="nickname-submit"
                style={{ opacity: nicknameInput.trim() ? 1 : 0.4 }}
              >
                →
              </button>
            </form>
          </div>
        </div>
      );
    }

    let text = "";
    let subtext = "";
    let overrideConfig = null;

    if (onboardingStep === 'ambient') {
      text = isAmbientStarted 
        ? "주변 소리만 있는 상태로\n5초간 기다려주세요."
        : "탭하여 주변 소음 측정을\n시작하세요.";
      overrideConfig = { color: [0x2a, 0x2a, 0x2a], baseRadius: 12 };
    } else if (onboardingStep === 'speech') {
      text = "지금처럼 편하게\n말해보세요. (10초)";
      subtext = '"오늘 날씨가 참 좋네요. 주변 사람들과 즐겁게 대화하며 기분 좋은 하루를 보내고 있어요."';
      overrideConfig = { color: [0x4a, 0xdf, 0x84], baseRadius: 38 };
    } else if (onboardingStep === 'complete') {
      text = "준비됐어요.";
      overrideConfig = { color: [0x4a, 0xdf, 0x84], baseRadius: 60 };
    }

    return (
      <div className="app onboarding" onClick={() => {
        if (onboardingStep === 'ambient' && !isAmbientStarted) {
          const ctx = window.audioContextInstance; 
          if (ctx && ctx.state === 'suspended') ctx.resume();
          setIsAmbientStarted(true);
        }
      }}>
        <BreathCanvas status="silent" overrideConfig={overrideConfig} />
        <div className="onboarding-content">
          <p className="onboarding-text">{errorMsg || text}</p>
          {subtext && <p className="onboarding-subtext">{subtext}</p>}
        </div>
        {(onboardingStep === 'ambient' || onboardingStep === 'speech') && isAmbientStarted && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${countdown}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (view === 'insight') {
    return <InsightView userId={user?.id} onBack={() => setView('main')} onSettings={() => setView('settings')} />;
  }

  if (view === 'settings') {
    return (
      <SettingsView 
        user={user} 
        onBack={() => setView('main')} // Fixed: go back to main
        onNicknameUpdate={(newNick) => setUser(prev => ({ ...prev, nickname: newNick }))}
        onRecalibrate={() => {
          setOnboardingStep('speech');
          setView('main');
        }}
      />
    );
  }

  return (
    <MainView 
      status={status}
      currentDb={currentDb}
      ambientDb={ambientDb}
      userId={user?.id}
      onNavigateToInsight={() => setView('insight')}
      onSettings={() => setView('settings')}
      sessionSeconds={currentSession?.samples?.length || 0}
    />
  );
}
