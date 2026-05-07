import { useEffect, useRef, useState, useCallback } from 'react';
import { THRESHOLDS, AMBIENT_SMOOTHING, SPEAKER_OFFSET } from './constants';

const FFT_SIZE = 2048;
const INITIAL_AMBIENT = 40; // conservative starting floor

export function useAudioAnalyzer() {
  const [status, setStatus] = useState('silent'); // silent | good | loud | danger
  const [currentDb, setCurrentDb] = useState(0);
  const [ambientDb, setAmbientDb] = useState(INITIAL_AMBIENT);
  const [permissionState, setPermissionState] = useState('pending'); // pending | granted | denied

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const ambientRef = useRef(INITIAL_AMBIENT);
  const lastHapticRef = useRef(0);

  const triggerHaptic = useCallback(() => {
    if (!navigator.vibrate) return;
    const now = Date.now();
    if (now - lastHapticRef.current < 1500) return; // 1.5s debounce
    lastHapticRef.current = now;
    navigator.vibrate([200, 100, 200]);
  }, []);

  const loop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(dataArray);

    // RMS → approximate SPL-like dB (offset +90 maps typical mic range to 0–120dB)
    let sumSq = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sumSq += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sumSq / dataArray.length);
    const rawDb = rms > 1e-10 ? 20 * Math.log10(rms) + 90 : 0;
    const db = Math.max(0, Math.min(120, rawDb));

    // Speech detection gate: must exceed ambient floor by SPEAKER_OFFSET
    const isSpeech = db >= ambientRef.current + SPEAKER_OFFSET;

    if (!isSpeech) {
      // Update ambient EMA only during non-speech segments
      ambientRef.current =
        ambientRef.current * (1 - AMBIENT_SMOOTHING) + db * AMBIENT_SMOOTHING;
    }

    // Determine status using absolute dB thresholds (only when speech detected)
    let newStatus;
    if (!isSpeech || db < THRESHOLDS.SILENCE) {
      newStatus = 'silent';
    } else if (db < THRESHOLDS.GOOD_MAX) {
      newStatus = 'good';
    } else if (db < THRESHOLDS.LOUD_MAX) {
      newStatus = 'loud';
    } else {
      newStatus = 'danger';
      triggerHaptic();
    }

    setCurrentDb(db); // keep as float for smoother canvas animation
    setAmbientDb(Math.round(ambientRef.current));
    setStatus(newStatus);

    rafRef.current = requestAnimationFrame(loop);
  }, [triggerHaptic]);

  useEffect(() => {
    let stream;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setPermissionState('granted');

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.5;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;

        rafRef.current = requestAnimationFrame(loop);
      } catch {
        setPermissionState('denied');
      }
    }

    start();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [loop]);

  return { status, currentDb, ambientDb, permissionState };
}
