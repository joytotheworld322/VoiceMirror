import { useRef, useEffect, useState, useMemo } from 'react';
import './App.css';
import { useAudioAnalyzer } from './useAudioAnalyzer';
import { LOCAL_STORAGE_KEYS } from './constants';
import MainView from './views/MainView';
import InsightView from './views/InsightView';
import BreathCanvas from './components/BreathCanvas';
import { useSessionRecorder } from './hooks/useSessionRecorder';

export default function App() {
  const [view, setView] = useState('main'); // main | insight
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

  // Temporary holder for recal level to pass into analyzer
  const [bridgeComfortLevel, setBridgeComfortLevel] = useState(null);

  const { status, currentDb, ambientDb, permissionState, triggerHaptic } = useAudioAnalyzer(personalizedLevels, bridgeComfortLevel);
  
  const { currentSession, sessionComfortLevel } = useSessionRecorder(
    currentDb, 
    status, 
    ambientDb, 
    onboardingStep === null && view === 'main' 
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
        if (db > onboardingData.ambientBaseline + 10) {
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
      
      const timeout = setTimeout(() => {
        setOnboardingStep(null);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [onboardingStep, onboardingData.ambientBaseline, isAmbientStarted]);

  const handleNicknameSubmit = (e) => {
    if (e) e.preventDefault();
    if (nicknameInput.trim()) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.NICKNAME, nicknameInput.trim());
      setOnboardingStep('ambient');
    }
  };

  // Reset logic
  const longPressRef = useRef(null);
  const handleResetStart = () => {
    longPressRef.current = setTimeout(() => {
      localStorage.clear();
      window.location.reload();
    }, 3000);
  };
  const handleResetEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
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
            <p className="nickname-note">
              현재 닉네임은 localStorage에만 저장. 추후 Supabase anonymous auth 연동 시 user metadata로 이전하여 다기기 동기화 예정.
            </p>
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
    return <InsightView currentSession={currentSession} onBack={() => setView('main')} />;
  }

  return (
    <MainView 
      status={status}
      currentDb={currentDb}
      ambientDb={ambientDb}
      onResetStart={handleResetStart}
      onResetEnd={handleResetEnd}
      onNavigateToInsight={() => setView('insight')}
      sessionSeconds={currentSession?.samples?.length || 0}
    />
  );
}
