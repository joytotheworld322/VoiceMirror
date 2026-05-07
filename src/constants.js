// Vocal loading thresholds
// Source: Pearsons et al. (1977), Echternach et al. vocal loading research
// Reference: ~30cm mic distance, typical conversation environment
export const THRESHOLDS = {
  SILENCE: 55,   // below → silent/ambient
  GOOD_MAX: 68,  // 55–68 → normal conversation (65 dBA ± 3)
  LOUD_MAX: 80,  // 68–80 → above average, pre-strain zone
                 // 80+ → exceeds vocal loading threshold (haptic zone)
};

// EMA smoothing factor for ambient floor (slow adaptation)
export const AMBIENT_SMOOTHING = 0.02;

// Minimum dB above ambient to classify as speech
// Mitigates other speakers being classified as ambient
export const SPEAKER_OFFSET = 15;

export const VIBRATION_PATTERN = [200, 100, 200];
