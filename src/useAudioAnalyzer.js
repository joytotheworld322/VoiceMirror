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

export function useAudioAnalyzer(personalizedLevels = null, sessionComfortLevel = null) {
  const [status, setStatus] = useState('silent');
  const [currentDb, setCurrentDb] = useState(0);
  const [ambientDb, setAmbientDb] = useState(40);
  const [permissionState, setPermissionState] = useState('pending');

  const latestDbRef = useRef(0);
  const ambientRef = useRef(40);
  const personalizedRef = useRef(personalizedLevels);
  const sessionComfortRef = useRef(sessionComfortLevel);

  useEffect(() => {
    personalizedRef.current = personalizedLevels;
    if (personalizedLevels) {
      ambientRef.current = personalizedLevels.ambientBaseline;
      setAmbientDb(Math.round(personalizedLevels.ambientBaseline));
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
        const voiceHigh = Math.ceil(3000 / binHz);

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

          // Frequency Analysis
          const voiceEnergy = dataArray.slice(voiceLow, voiceHigh).reduce((a, b) => a + b, 0);
          const totalEnergy = dataArray.reduce((a, b) => a + b, 0);
          const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;
          const isVoiceLike = voiceRatio >= VOICE_RATIO_MIN;

          let nextStatus = 'silent';

          if (isVoiceLike) {
            const curAmbient = ambientRef.current;
            const isSpeaking = db > curAmbient + SPEAKER_OFFSET;

            // Ambient update only if NOT speaking
            if (!isSpeaking) {
              ambientRef.current = AMBIENT_ALPHA * db + (1 - AMBIENT_ALPHA) * curAmbient;
              setAmbientDb(Math.round(ambientRef.current));
            }

            const relative = db - curAmbient;
            const levels = personalizedRef.current;
            const sComfort = sessionComfortRef.current;
            
            // Determine Gap: Use session recalibration if available, else onboarding
            const effectiveComfortGap = sComfort 
              ? (sComfort - curAmbient) 
              : (levels ? (levels.comfortableLevel - levels.ambientBaseline) : 0);

            if (effectiveComfortGap > 10) { // Relative mode
              const ratio = relative / effectiveComfortGap;
              if (ratio < RATIO.SILENT_MAX) nextStatus = 'silent';
              else if (ratio <= RATIO.GOOD_MAX) nextStatus = 'good';
              else if (ratio <= RATIO.LOUD_MAX) nextStatus = 'loud';
              else nextStatus = 'danger';
            } else { // Fallback: Absolute mode
              if (db < THRESHOLDS.SILENCE) nextStatus = 'silent';
              else if (db < THRESHOLDS.GOOD_MAX) nextStatus = 'good';
              else if (db < THRESHOLDS.LOUD_MAX) nextStatus = 'loud';
              else nextStatus = 'danger';
            }

            if (DEBUG_MODE && Math.random() < 0.05) { // Log sampled frames
              console.log({
                currentDb: db.toFixed(1),
                ambientFloor: curAmbient.toFixed(1),
                relative: relative.toFixed(1),
                effectiveComfortGap: effectiveComfortGap.toFixed(1),
                ratio: effectiveComfortGap > 10 ? (relative / effectiveComfortGap).toFixed(2) : 'fallback',
                voiceRatio: voiceRatio.toFixed(2),
                isVoiceLike,
                isSpeaking,
                sessionComfort: sComfort?.toFixed(1) ?? 'not set',
                state: nextStatus,
              });
            }
          } else {
            // Force silent if not voice-like
            nextStatus = 'silent';
            // Ambient still updates when silent
            const curAmbient = ambientRef.current;
            ambientRef.current = AMBIENT_ALPHA * db + (1 - AMBIENT_ALPHA) * curAmbient;
            setAmbientDb(Math.round(ambientRef.current));
          }

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
  }, []);

  return { status, currentDb, ambientDb, permissionState, triggerHaptic };
}
