import { useState, useEffect, useRef } from 'react';
import BreathCanvas from '../components/BreathCanvas';
import { ONBOARDING_VOICE_MIN } from '../constants';
import { updateUserProfile } from '../lib/userService';

export default function OnboardingAmbient({ userId, isNewUser, currentDb, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('silent');
  
  // 실시간 브레스 상태 제어
  useEffect(() => {
    if (currentDb > 40) {
      setStatus('good');
    } else {
      setStatus('silent');
    }
  }, [currentDb]);

  const dbRef = useRef(currentDb);
  useEffect(() => {
    dbRef.current = currentDb;
  }, [currentDb]);

  const samplesRef = useRef([]);
  const startTimeRef = useRef(Date.now());
  const DURATION = 5000;

  useEffect(() => {
    const frameId = requestAnimationFrame(function update() {
      const elapsed = Date.now() - startTimeRef.current;
      const p = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(p);

      const latestDb = dbRef.current;
      if (latestDb < ONBOARDING_VOICE_MIN) {
        samplesRef.current.push(latestDb);
      }

      if (elapsed < DURATION) {
        requestAnimationFrame(update);
      } else {
        handleFinish();
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleFinish = async () => {
    const avg = samplesRef.current.length > 0 
      ? samplesRef.current.reduce((a, b) => a + b, 0) / samplesRef.current.length 
      : 40;
    
    setStatus('good'); 

    try {
      if (isNewUser) {
        await updateUserProfile(userId, { ambient_baseline: avg });
      }
      setTimeout(() => {
        onComplete(avg);
      }, 1000);
    } catch (err) {
      setTimeout(() => {
        onComplete(avg);
      }, 1000);
    }
  };

  return (
    <div className="app onboarding" style={{ background: '#0e0e0e' }}>
      <div className="onboarding-step-indicator" style={{ position: 'absolute', top: '60px', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', zIndex: 100 }}>
        {isNewUser ? (
          <><span className="dot active"></span><span className="dot active"></span><span className="dot"></span></>
        ) : (
          <><span className="dot active"></span><span className="dot"></span></>
        )}
      </div>

      <BreathCanvas status="measuring" currentDb={currentDb} />

      <div className="onboarding-content" style={{ zIndex: 10 }}>
        <p className="onboarding-text" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
          주변 소리를 측정할게요.
        </p>
        <p className="onboarding-subtext" style={{ 
          fontSize: '10px', 
          color: 'rgba(255,255,255,0.3)', 
          lineHeight: 1.8,
          fontStyle: 'normal' 
        }}>
          {"말하지 말고 잠시 기다려주세요."}
        </p>
      </div>

      <div className="onboarding-progress-bar">
        <div className="fill" style={{ width: `${progress}%`, transition: 'none' }}></div>
      </div>
    </div>
  );
}
