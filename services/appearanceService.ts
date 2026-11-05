/**
 * Appearance and theme management service for Voice Scribe
 */

export type ThemePreset = 'dark' | 'midnight' | 'cyberpunk';
export type VisualizerPreset = 'waves' | 'bars' | 'minimal';
export type FontSizePreset = 'sm' | 'md' | 'lg';

export interface AppearanceConfig {
  theme: ThemePreset;
  visualizer: VisualizerPreset;
  fontSize: FontSizePreset;
  autoCopy: boolean;
  soundFx: boolean;
}

export const STORAGE_KEYS = {
  theme: 'voicescribe_theme',
  visualizer: 'voicescribe_visualizer',
  fontSize: 'voicescribe_font_size',
  autoCopy: 'voicescribe_auto_copy',
  soundFx: 'voicescribe_sound_fx',
} as const;

export const DEFAULT_APPEARANCE_CONFIG: AppearanceConfig = {
  theme: 'dark',
  visualizer: 'waves',
  fontSize: 'md',
  autoCopy: true,
  soundFx: false,
};

const APPEARANCE_UPDATED_EVENT = 'voicescribe:appearance-updated';

function isValidTheme(val: any): val is ThemePreset {
  return val === 'dark' || val === 'midnight' || val === 'cyberpunk';
}

function isValidVisualizer(val: any): val is VisualizerPreset {
  return val === 'waves' || val === 'bars' || val === 'minimal';
}

function isValidFontSize(val: any): val is FontSizePreset {
  return val === 'sm' || val === 'md' || val === 'lg';
}

export function applyAppearanceToDOM(config: AppearanceConfig): void {
  if (typeof document === 'undefined') return;
  try {
    document.documentElement.setAttribute('data-theme-preset', config.theme);
    document.documentElement.setAttribute('data-font-size', config.fontSize);
    if (document.body) {
      document.body.setAttribute('data-theme-preset', config.theme);
    }
  } catch (e) {
    console.warn('Failed to apply appearance to DOM', e);
  }
}

export function getAppearanceConfig(): AppearanceConfig {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_APPEARANCE_CONFIG };
  }

  try {
    const rawTheme = localStorage.getItem(STORAGE_KEYS.theme);
    const rawVisualizer = localStorage.getItem(STORAGE_KEYS.visualizer);
    const rawFontSize = localStorage.getItem(STORAGE_KEYS.fontSize);
    const rawAutoCopy = localStorage.getItem(STORAGE_KEYS.autoCopy);
    const rawSoundFx = localStorage.getItem(STORAGE_KEYS.soundFx);

    const theme = isValidTheme(rawTheme) ? rawTheme : DEFAULT_APPEARANCE_CONFIG.theme;
    const visualizer = isValidVisualizer(rawVisualizer) ? rawVisualizer : DEFAULT_APPEARANCE_CONFIG.visualizer;
    const fontSize = isValidFontSize(rawFontSize) ? rawFontSize : DEFAULT_APPEARANCE_CONFIG.fontSize;
    const autoCopy = rawAutoCopy !== null ? rawAutoCopy !== 'false' : DEFAULT_APPEARANCE_CONFIG.autoCopy;
    const soundFx = rawSoundFx === 'true';

    return { theme, visualizer, fontSize, autoCopy, soundFx };
  } catch {
    return { ...DEFAULT_APPEARANCE_CONFIG };
  }
}

export function updateAppearanceConfig(updates: Partial<AppearanceConfig>): AppearanceConfig {
  const current = getAppearanceConfig();
  const next: AppearanceConfig = {
    ...current,
    ...updates,
  };

  if (typeof localStorage !== 'undefined') {
    try {
      if (updates.theme !== undefined) localStorage.setItem(STORAGE_KEYS.theme, next.theme);
      if (updates.visualizer !== undefined) localStorage.setItem(STORAGE_KEYS.visualizer, next.visualizer);
      if (updates.fontSize !== undefined) localStorage.setItem(STORAGE_KEYS.fontSize, next.fontSize);
      if (updates.autoCopy !== undefined) localStorage.setItem(STORAGE_KEYS.autoCopy, String(next.autoCopy));
      if (updates.soundFx !== undefined) localStorage.setItem(STORAGE_KEYS.soundFx, String(next.soundFx));
    } catch (e) {
      console.warn('Failed to persist appearance settings', e);
    }
  }

  applyAppearanceToDOM(next);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<AppearanceConfig>(APPEARANCE_UPDATED_EVENT, { detail: next }));
  }

  return next;
}

export function subscribeAppearanceUpdates(callback: (config: AppearanceConfig) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AppearanceConfig>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(APPEARANCE_UPDATED_EVENT, handler);
  return () => {
    window.removeEventListener(APPEARANCE_UPDATED_EVENT, handler);
  };
}

/**
 * Play subtle audio chime for recording start or stop
 */
export function playSoundFeedback(type: 'start' | 'stop'): void {
  const config = getAppearanceConfig();
  if (!config.soundFx) return;

  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    if (type === 'start') {
      // Pleasant double chirp up (480Hz -> 720Hz)
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      // Gentle soft chime down (720Hz -> 360Hz)
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(360, now + 0.1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 300);
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
}

