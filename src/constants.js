// Vocal loading thresholds
// Source: Pearsons et al. (1977), Echternach et al. vocal loading research
export const THRESHOLDS = {
  SILENCE:  55,
  GOOD_MAX: 68,
  LOUD_MAX: 80,
};

export const VOCAL_STRAIN_ABS = 85;   // Absolute dB threshold for vocal strain
export const DEBUG_MODE = true;       // Set to false for production

export const RATIO = {
  SILENT_MAX: 0.5,
  GOOD_MAX:   1.2,
  LOUD_MAX:   1.6,
};

export const RECAL = {
  WINDOW_SEC:    60,   // Collection window for recalibration
  MIN_VOICE_SEC: 10,   // Min voice accumulation for finalizing recal
};

export const LOCAL_STORAGE_KEYS = {
  AMBIENT_BASELINE: 'vm_ambient_baseline',
  COMFORTABLE_LEVEL: 'vm_comfortable_level',
  ONBOARDING_COMPLETE: 'vm_onboarding_complete',
  NICKNAME: 'vm_nickname',
};

export const AMBIENT_ALPHA = 0.005;   // EMA update speed (lower is slower)
export const SPEAKER_OFFSET = 15;      // dB difference to be recognized as speaking
export const VOICE_RATIO_MIN = 0.4;    // Minimum frequency energy ratio for human voice

export const STATE_CONFIG = {
  silent: { bg: '#0e0e0e', label: 'SILENT' },
  good: { bg: '#0a1a0f', label: 'GOOD' },
  loud: { bg: '#1a1a0a', label: 'LOUD' },
  danger: { bg: '#1a0a0a', label: 'DANGER' },
};

export const VIBRATION_PATTERN = [200, 100, 200];
