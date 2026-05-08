import { useState, useEffect, useRef } from 'react';
import BreathCanvas from '../components/BreathCanvas';
import { updateUserProfile } from '../lib/userService';

export default function OnboardingVoice({ userId, currentDb, ambientDb, isVoiceLike, onComplete, onBack, isSingleStep = false }) {
  const [step, setStep] = useState('ambient_measuring'); // 'ambient_measuring' -> 'measuring' -> 'saving' -> 'complete'
  const [progress, setProgress] = useState(0); 
  const [status, setStatus] = useState('silent');
  const [isRetry, setIsRetry] = useState(false);
  const [uiIsSpeaking, setUiIsSpeaking] = useState(false);
  const [saveError, setSaveError] = useState(null); 
  
  const [calibratedBaseline, setCalibratedBaseline] = useState(ambientDb || 40);

  const dbRef = useRef(currentDb);
  const voiceLikeRef = useRef(isVoiceLike);
  const samplesRef = useRef([]);
  
  const AMBIENT_DURATION = 3000; // 주변 환경 측정 3초
  const VOICE_DURATION = 10000;  // 목소리 측정 10초
  const MIN_SAMPLES = 40;   
  
  const startTimeRef = useRef(Date.now());
  const speechCounterRef = useRef(0);

  useEffect(() => {
    dbRef.current = currentDb;
    voiceLikeRef.current = isVoiceLike;
  }, [currentDb, isVoiceLike]);

  useEffect(() => {
    if (step === 'ambient_measuring') {
      const ambientSamples = [];
      const start = Date.now();
      const WARMUP_TIME = 500; // 첫 0.5초는 마이크 안정화를 위해 버림
      
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - start;
        const latestDb = dbRef.current;
        
        // 워밍업 시간이 지난 후에만 샘플 수집
        if (elapsed > WARMUP_TIME) {
          ambientSamples.push(latestDb);
        }
        
        setProgress((elapsed / AMBIENT_DURATION) * 100);

        if (elapsed >= AMBIENT_DURATION) {
          clearInterval(interval);
          if (ambientSamples.length > 0) {
            const avgAmbient = ambientSamples.reduce((a,b)=>a+b,0) / ambientSamples.length;
            setCalibratedBaseline(Math.round(avgAmbient));
          }
          setStep('measuring');
          setProgress(0);
        }
      }, 50);
      return () => clearInterval(interval);
    }

    if (step === 'measuring') {
      samplesRef.current = [];
      startTimeRef.current = Date.now();
      speechCounterRef.current = 0;
      setUiIsSpeaking(false);

      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        const latestDb = dbRef.current;

        const timeProgress = Math.min(100, (elapsed / VOICE_DURATION) * 100);
        setProgress(timeProgress);

        const isSpeakingNow = (latestDb > (calibratedBaseline + 8)) && voiceLikeRef.current;

        if (isSpeakingNow) {
          samplesRef.current.push(latestDb);
          setStatus('measuring');
          speechCounterRef.current += 1;
          if (speechCounterRef.current > 2) setUiIsSpeaking(true);
        } else {
          setStatus('silent');
          speechCounterRef.current = 0;
          setUiIsSpeaking(false);
        }

        if (elapsed >= VOICE_DURATION) {
          clearInterval(interval);
          if (samplesRef.current.length >= MIN_SAMPLES) {
            handleFinish();
          } else {
            setIsRetry(true);
            setStep('measuring_reset'); 
            setTimeout(() => setStep('measuring'), 10);
          }
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [step]); 

  const handleFinish = async () => {
    const avg = samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length;
    setStep('saving');
    try {
      if (!userId) throw new Error("유저 정보를 찾을 수 없습니다.");
      await updateUserProfile(userId, { comfortable_level: avg });
      setStep('complete');
      setTimeout(onComplete, 2500);
    } catch (err) {
      setSaveError(err.message || JSON.stringify(err));
      setStep('error');
    }
  };

  // 공통 헤더 렌더링
  const headerJsx = onBack && (
    <header className="insight-header" style={{ borderBottom: 'none', position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 100 }}>
      <button className="back-button-text" onClick={onBack} style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>←</button>
      <div />
    </header>
  );

  if (step === 'error') {
    return (
      <div className="app onboarding" style={{ background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
        <div>
          <p style={{ color: '#ff5252', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>저장 실패</p>
          <button onClick={() => setStep('ambient_measuring')} className="action-btn-small primary">다시 시도하기</button>
        </div>
      </div>
    );
  }

  if (step === 'saving') {
    return (
      <div className="app onboarding" style={{ background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <p style={{ color: '#4adf84', fontSize: '14px', fontWeight: 'bold' }}>데이터 저장 중...</p>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="app onboarding" style={{ background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
        <div style={{ zIndex: 10, width: '100%' }}>
          <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(74, 223, 132, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(74, 223, 132, 0.15)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4adf84" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#4adf84', marginBottom: '20px' }}>준비됐어요!</h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>이제 다시 VoiceMirror를 시작해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app onboarding" style={{ background: '#0e0e0e', position: 'relative' }}>
      {headerJsx}
      <BreathCanvas status={step === 'ambient_measuring' ? 'silent' : status} currentDb={currentDb} />

      <div className="onboarding-content" style={{ padding: '0 40px', textAlign: 'center', zIndex: 10 }}>
        <div style={{ minHeight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
            {step === 'ambient_measuring' ? '주변 환경 소음 측정 중' : '편안한 목소리 측정 중'}
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            {step === 'ambient_measuring' 
              ? '주변 소음을 파악하고 있어요.\n잠시만 조용히 해주세요.' 
              : (isRetry && !uiIsSpeaking ? '발화가 너무 짧아요.\n다시 한번 문장을 읽어주세요.' : '아래 문장을 평소처럼 편안하게 읽어주세요.')}
          </p>
        </div>

        {step === 'measuring' && (
          <div style={{ 
            background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px 24px', fontSize: '16px', color: '#4adf84', lineHeight: 1.6, fontWeight: 700, whiteSpace: 'pre-line', marginTop: '20px'
          }}>
            {"오늘 날씨가 참 좋네요.\n산책이라도 나가볼까요?"}
          </div>
        )}
      </div>

      <div className="onboarding-progress-bar">
        <div className="fill" style={{ width: `${progress}%`, transition: 'none', background: step === 'ambient_measuring' ? 'rgba(255,255,255,0.3)' : '#4adf84' }}></div>
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '0', width: '100%', display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>
        <span>V:{Math.round(currentDb)}dB</span>
        <span>B:{calibratedBaseline}dB</span>
        {step === 'measuring' && <span>SAMPLES:{samplesRef.current.length}/40</span>}
      </div>
    </div>
  );
}
