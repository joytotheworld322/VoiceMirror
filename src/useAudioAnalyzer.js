import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  RATIO, 
  THRESHOLDS, 
  VIBRATION_PATTERN, 
  AMBIENT_ALPHA, 
  SPEAKER_OFFSET, 
  VOICE_RATIO_MIN, 
  DEBUG_MODE 
} from './constants';

export default function useAudioAnalyzer(personalizedLevels = null, sessionComfortLevel = null, enabled = true) {
  const [status, setStatus] = useState('silent');
  const [currentDb, setCurrentDb] = useState(0);
  const [ambientDb, setAmbientDb] = useState(40);
  const [permissionState, setPermissionState] = useState('pending');
  const [isVoiceLike, setIsVoiceLike] = useState(false);

  const latestDbRef = useRef(0);
  const ambientRef = useRef(40);
  const config = useRef({
    ambient: personalizedLevels?.ambient || 40,
    comfortable: personalizedLevels?.comfortable || 55
  });
  const sessionComfortRef = useRef(sessionComfortLevel);

  // [지능형 보정] 장시간 지속되는 소음을 감지하기 위한 레퍼런스
  const noiseFloorTimerRef = useRef(0);

  useEffect(() => {
    if (personalizedLevels) {
      config.current = {
        ambient: personalizedLevels.ambient ?? 40,
        comfortable: personalizedLevels.comfortable ?? 55
      };
      ambientRef.current = config.current.ambient;
      setAmbientDb(Math.round(ambientRef.current));
    }
  }, [personalizedLevels]);

  useEffect(() => {
    sessionComfortRef.current = sessionComfortLevel;
  }, [sessionComfortLevel]);

  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(VIBRATION_PATTERN);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let audioContext;
    let analyser;
    let stream;
    let rafId;

    async function setupAudio() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissionState('granted');

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        window.audioContextInstance = audioContext; 
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeDataArray = new Uint8Array(bufferLength);

        const sampleRate = audioContext.sampleRate;
        const binHz = sampleRate / analyser.fftSize;
        const voiceLow = Math.floor(85 / binHz);
        const voiceHigh = Math.ceil(4000 / binHz);

        function update() {
          analyser.getByteFrequencyData(dataArray);
          analyser.getByteTimeDomainData(timeDataArray);

          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const val = (timeDataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / bufferLength);
          const db = rms > 0 ? 20 * Math.log10(rms) + 100 : 0; 
          
          setCurrentDb(db);
          latestDbRef.current = db;

          const voiceEnergy = dataArray.slice(voiceLow, voiceHigh).reduce((a, b) => a + b, 0);
          const totalEnergy = dataArray.reduce((a, b) => a + b, 0);
          const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
          
          // 목소리 여부 판정 (최소 음량 게이트 포함)
          const isVoiceLikeResult = db > 42 && voiceRatio >= VOICE_RATIO_MIN;

          let nextStatus = 'silent';
          const curAmbient = ambientRef.current;

          if (isVoiceLikeResult) {
            const relative = db - curAmbient;
            const levels = config.current;
            const sComfort = sessionComfortRef.current;
            
            const effectiveComfortGap = sComfort 
              ? (sComfort - curAmbient) 
              : (levels ? (levels.comfortable - levels.ambient) : 0);

            // [자동 보정 로직 1] 목소리로 판정되었지만 현재 소음 기준점보다 작다면 즉시 하향 조정
            if (db < curAmbient) {
              ambientRef.current = 0.1 * db + 0.9 * curAmbient; // 빠른 추적
              setAmbientDb(Math.round(ambientRef.current));
            }

            if (effectiveComfortGap > 10) {
              const ratio = relative / effectiveComfortGap;
              if (ratio < RATIO.SILENT_MAX) nextStatus = 'silent';
              else if (ratio <= RATIO.GOOD_MAX) nextStatus = 'good';
              else if (ratio <= RATIO.LOUD_MAX) nextStatus = 'loud';
              else nextStatus = 'danger';
            } else {
              if (db < THRESHOLDS.SILENCE) nextStatus = 'silent';
              else if (db < THRESHOLDS.GOOD_MAX) nextStatus = 'good';
              else if (db < THRESHOLDS.LOUD_MAX) nextStatus = 'loud';
              else nextStatus = 'danger';
            }
            
            noiseFloorTimerRef.current = 0; // 목소리가 들리면 소음 추적 타이머 초기화
          } else {
            nextStatus = 'silent';
            
            // [자동 보정 로직 2] 배경 소음 추적 (상향/하향 모두 대응)
            // 목소리가 아닐 때, 현재 dB가 기준점과 차이가 나면 서서히 흡수
            const diff = Math.abs(db - curAmbient);
            if (diff > 0.5) {
              // AMBIENT_ALPHA를 사용하여 노이즈 플로어를 서서히 업데이트
              ambientRef.current = AMBIENT_ALPHA * db + (1 - AMBIENT_ALPHA) * curAmbient;
              setAmbientDb(Math.round(ambientRef.current));
            }
          }

          setIsVoiceLike(isVoiceLikeResult);
          setStatus(nextStatus);
          rafId = requestAnimationFrame(update);
        }

        update();
      } catch (err) {
        console.error('Audio setup failed:', err);
        setPermissionState('denied');
      }
    }

    setupAudio();

    return () => {
      cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (audioContext) audioContext.close();
    };
  }, [enabled]);

  return { status, currentDb, ambientDb, permissionState, triggerHaptic, isVoiceLike };
}
