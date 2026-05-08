import { useState, useEffect, useRef } from 'react';
import BreathCanvas from '../components/BreathCanvas';
import { updateUserProfile } from '../lib/userService';

export default function OnboardingVoice({ userId, currentDb, ambientDb, isVoiceLike, onComplete, onBack, isSingleStep = false }) {
  const [step, setStep] = useState('measuring'); 
  const [progress, setProgress] = useState(0); 
  const [status, setStatus] = useState('silent');
  const [isRetry, setIsRetry] = useState(false);
  const [uiIsSpeaking, setUiIsSpeaking] = useState(false);
  const [saveError, setSaveError] = useState(null); 
  
  const [calibratedBaseline, setCalibratedBaseline] = useState(ambientDb || 40);

  const dbRef = useRef(currentDb);
  const voiceLikeRef = useRef(isVoiceLike);
  const samplesRef = useRef([]);
  
  const MIN_SAMPLES = 40;   
  const TOTAL_DURATION = 10000; 
  
  const startTimeRef = useRef(Date.now());
  const speechCounterRef = useRef(0);

  useEffect(() => {
    dbRef.current = currentDb;
    voiceLikeRef.current = isVoiceLike;
  }, [currentDb, isVoiceLike]);

  useEffect(() => {
    if (step === 'measuring') {
      samplesRef.current = [];
      setProgress(0);
      setSaveError(null);
      startTimeRef.current = Date.now();
      speechCounterRef.current = 0;
      setUiIsSpeaking(false);
      
      let initialAmbientSamples = [];

      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        const latestDb = dbRef.current;

        if (elapsed < 1000) {
          initialAmbientSamples.push(latestDb);
          if (initialAmbientSamples.length > 10) {
            const newBase = initialAmbientSamples.reduce((a,b)=>a+b,0) / initialAmbientSamples.length;
            setCalibratedBaseline(Math.round(newBase));
          }
          return;
        }

        const timeProgress = Math.min(100, ((elapsed - 1000) / (TOTAL_DURATION - 1000)) * 100);
        setProgress(timeProgress);

        const baseline = calibratedBaseline;
        const isSpeakingNow = (latestDb > (baseline + 8)) && voiceLikeRef.current;

        if (isSpeakingNow) {
          samplesRef.current.push(latestDb);
          setStatus('measuring');
          speechCounterRef.current += 1;
          if (speechCounterRef.current > 2) {
            setUiIsSpeaking(true);
          }
        } else {
          setStatus('silent');
          speechCounterRef.current = 0;
          setUiIsSpeaking(false);
        }

        if (elapsed >= TOTAL_DURATION) {
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
    if (samplesRef.current.length === 0) return;
    
    const avg = samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length;
    setStep('saving');
    setStatus('measuring');

    try {
      if (!userId) throw new Error("유저 정보를 찾을 수 없습니다.");
      await updateUserProfile(userId, { comfortable_level: avg });
      setStep('complete');
      setTimeout(onComplete, 2500);
    } catch (err) {
      console.error('SAVE ERROR:', err);
      setSaveError(err.message || JSON.stringify(err));
      setStep('error');
    }
  };

  if (step === 'error') {
    return (
      <div className="app onboarding" style={{ background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
        <div>
          <p style={{ color: '#ff5252', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>저장 실패</p>
          <div style={{ background: 'rgba(255,59,59,0.1)', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '0.5px solid rgba(255,59,59,0.2)' }}>
            <p style={{ color: '#ff5252', fontSize: '11px', fontFamily: 'Space Mono', wordBreak: 'break-all' }}>{saveError}</p>
          </div>
          <button onClick={() => { setIsRetry(true); setStep('measuring'); }} style={{ background: '#ffffff', color: '#0e0e0e', border: 'none', padding: '12px 24px', borderRadius: '8px', fontFamily: 'Space Mono', fontSize: '12px', cursor: 'pointer' }}>다시 시도하기</button>
        </div>
      </div>
    );
  }

  if (step === 'saving') {
    return (
      <div className="app onboarding" style={{ background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <p style={{ color: '#4adf84', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>수집 완료!</p>
          <p style={{ color: 'white', fontSize: '12px' }}>데이터를 안전하게 저장하고 있어요...</p>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="app onboarding success" style={{ background: '#0e0e0e' }}>
        <BreathCanvas status="measuring" currentDb={currentDb} overrideConfig={{ baseRadius: 60 }} />
        <div className="onboarding-content">
          <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#4adf84', marginBottom: '8px' }}>준비됐어요.</p>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>목소리 기준 설정이 완료되었습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app onboarding" style={{ background: '#0e0e0e', position: 'relative' }}>
      {/* [수정] 설정창(SettingsView) 헤더 구조와 100% 동일하게 구현 */}
      {onBack && (
        <header className="insight-header" style={{ borderBottom: 'none', position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 100 }}>
          <button className="back-button-text" onClick={onBack} style={{ color: 'white', fontSize: '18px' }}>←</button>
          <span className="app-name-small" style={{ letterSpacing: '0.2em' }}>VOICEMIRROR</span>
        </header>
      )}

      <BreathCanvas status={status} currentDb={currentDb} />

      <div className="onboarding-content" style={{ padding: '0 40px', textAlign: 'center', zIndex: 10 }}>
        <div style={{ minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', transition: 'all 0.3s' }}>
            {(isRetry && !uiIsSpeaking ? '발화가 너무 짧아요. 다시 한번 문장을 읽어주세요.' : '편안한 상태의 목소리를 들려주세요.')}
          </p>
        </div>
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.9, marginBottom: '28px' }}>
          {"지금 측정한 목소리를 기준 삼아\n앞으로의 발화 상태를 판단할 예정이에요."}
        </p>

        <div style={{ 
          background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '24px 20px', fontFamily: 'Space Mono', fontSize: '14px', color: '#4adf84', lineHeight: 1.8, fontWeight: 'bold'
        }}>
          {"오늘 날씨가 참 좋네요.\n산책이라도 나가볼까요?"}
        </div>
      </div>

      <div className="onboarding-progress-bar">
        <div className="fill" style={{ width: `${progress}%`, transition: 'none' }}></div>
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '0', width: '100%', display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '8px', fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>
        <span>V:{Math.round(currentDb)}dB</span>
        <span>B:{calibratedBaseline}dB</span>
        <span>SAMPLES:{samplesRef.current.length}/40</span>
      </div>
    </div>
  );
}
