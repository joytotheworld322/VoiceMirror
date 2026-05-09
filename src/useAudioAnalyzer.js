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

  // Refs for persistent audio resources
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafIdRef = useRef(null);


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

  // ── 오디오 설정 및 생명주기 관리 ──────────────────────────
  useEffect(() => {
    // 1. 초기 스트림 및 컨텍스트 초기화 (한 번만 수행)
    async function initAudio() {
      if (streamRef.current) return; // 이미 초기화됨

      try {
        console.log('--- 마이크 스트림 초기화 시도 ---');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false
          } 
        });
        streamRef.current = stream;
        setPermissionState('granted');

        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'interactive',
        });
        audioContextRef.current = audioContext;
        window.audioContextInstance = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        startAnalysisLoop();
      } catch (err) {
        console.error('Audio setup failed:', err);
        setPermissionState('denied');
      }
    }

    function startAnalysisLoop() {
      if (rafIdRef.current) return;

      const analyser = analyserRef.current;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeDataArray = new Uint8Array(bufferLength);

      const sampleRate = audioContextRef.current.sampleRate;
      const binHz = sampleRate / analyser.fftSize;
      const voiceLow = Math.floor(85 / binHz);
      const voiceHigh = Math.ceil(4000 / binHz);

      function update() {
        if (!analyser) return;
        
        analyser.getByteFrequencyData(dataArray);
        analyser.getByteTimeDomainData(timeDataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (timeDataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / bufferLength);
        const db = rms > 0 ? 20 * Math.log10(rms) + 90 : 0; 
        
        setCurrentDb(db);
        latestDbRef.current = db;

        const voiceEnergy = dataArray.slice(voiceLow, voiceHigh).reduce((a, b) => a + b, 0);
        const totalEnergy = dataArray.reduce((a, b) => a + b, 0);
        const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
        
        const isVoiceLikeResult = db > 40 && voiceRatio >= VOICE_RATIO_MIN;

        let nextStatus = 'silent';
        const curAmbient = ambientRef.current;

        if (isVoiceLikeResult) {
          const relative = db - curAmbient;
          const levels = config.current;
          const sComfort = sessionComfortRef.current;
          const effectiveComfortGap = Math.max(20, sComfort ? (sComfort - curAmbient) : (levels ? (levels.comfortable - levels.ambient) : 0));

          if (db < curAmbient) {
            ambientRef.current = 0.1 * db + 0.9 * curAmbient;
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
          noiseFloorTimerRef.current = 0;
        } else {
          nextStatus = 'silent';
          const diff = Math.abs(db - curAmbient);
          if (diff > 0.5) {
            ambientRef.current = AMBIENT_ALPHA * db + (1 - AMBIENT_ALPHA) * curAmbient;
            setAmbientDb(Math.round(ambientRef.current));
          }
        }

        setIsVoiceLike(isVoiceLikeResult);
        setStatus(nextStatus);
        rafIdRef.current = requestAnimationFrame(update);
      }

      update();
    }

    initAudio();

    // 앱 종료 시에만 완전 종료 (일반적인 cleanup은 수행하지 않음)
    // 컴포넌트 언마운트 시 스트림을 끄지 않고 유지하여 재진입 시 팝업 방지
  }, []); // 빈 의존성 배열: 앱 생명주기 동안 한 번만 실행

  // 2. 활성/비활성 상태에 따른 오디오 컨텍스트 제어
  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (enabled) {
      if (ctx.state === 'suspended') {
        console.log('--- 오디오 컨텍스트 재개 ---');
        ctx.resume();
      }
    } else {
      if (ctx.state === 'running') {
        console.log('--- 오디오 컨텍스트 일시정지 ---');
        ctx.suspend();
      }
    }
  }, [enabled]);

  // 3. 전체 cleanup (애플리케이션이 종료될 때를 대비)
  useEffect(() => {
    return () => {
      // 실제로는 PWA 환경에서 unmount가 자주 일어나지 않지만, 메모리 관리 차원
      // 스트림은 유지하되 루프만 중단할 수도 있음
    };
  }, []);


  return { status, currentDb, ambientDb, permissionState, triggerHaptic, isVoiceLike };
}
