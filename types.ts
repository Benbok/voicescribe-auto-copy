export interface TranscriptionState {
  isRecording: boolean;
  isProcessing: boolean;
  text: string;
  error: string | null;
  copied: boolean;
}

export enum RecorderStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
}

export type TranscriptionMode = 'general' | 'corrector' | 'translator';
export type TranscriptionProvider = 'gemini' | 'yandex';

export type UpdaterStatus =
  | 'idle'
  | 'disabled'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdaterState {
  status: UpdaterStatus;
  message: string;
  progressPercent: number;
  availableVersion: string | null;
  currentVersion: string;
}

export interface RecordingShortcutState {
  accelerator: string;
  registered: boolean;
  error: string;
}

export interface ElectronAPI {
  copyAndPasteText?: (text: string) => Promise<{ copied: boolean; pasted: boolean; reason?: string }>;
  getRecordingShortcut?: () => Promise<RecordingShortcutState>;
  setRecordingShortcut?: (accelerator: string) => Promise<RecordingShortcutState>;
  onRecordingToggle?: (callback: () => void) => (() => void);
  onShortcutStateChange?: (callback: (state: RecordingShortcutState) => void) => (() => void);
  writeClipboardText?: (text: string) => Promise<void>;
  setRecordingStatus?: (status: RecorderStatus | 'ERROR') => void;
  toggleMiniMode: (enabled: boolean) => Promise<void>;
  setAlwaysOnTop?: (value: boolean) => Promise<void>;
  fetchApi?: (url: string, options: Record<string, unknown>) => Promise<unknown>;
  minimizeWindow?: () => Promise<void>;
  closeWindow?: () => Promise<void>;
  getUpdaterState?: () => Promise<UpdaterState>;
  checkForUpdates?: () => Promise<UpdaterState>;
  downloadUpdate?: () => Promise<UpdaterState>;
  quitAndInstallUpdate?: () => Promise<UpdaterState>;
  onUpdaterStateChange?: (callback: (state: UpdaterState) => void) => (() => void);
}

// Electron environment variables interface
declare global {
  interface Window {
    electronEnv?: {
      [key: string]: unknown;
      get?: (key: string) => string | undefined;
      getAll?: () => Record<string, string>;
    };
    electronAPI?: ElectronAPI;
  }
}
