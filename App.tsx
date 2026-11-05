
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, AlertCircle, Check, Copy, RotateCw, Settings as SettingsIcon, Monitor, History, Maximize2, X, Minus } from 'lucide-react';
import { RecorderStatus, UpdaterState } from './types';
import { setGeminiApiKey, setGeminiModel, getGeminiModel } from './services/geminiService';
import type { TranscriptionMode } from './types';
import { transcribeAudio, getTranscriptionProvider, checkProviderHealth } from './services/transcriptionService';
import { saveRecording } from './services/storageService';
import { DEFAULT_QUOTA_CONFIG, getQuotaPercentage, getQuotaConfig, getRemainingQuota, subscribeToQuotaUpdates } from './services/quotaService';
import { checkForUpdates, downloadUpdate, getUpdaterState, quitAndInstallUpdate, subscribeUpdaterState } from './services/updaterService';
import Visualizer from './components/Visualizer';
import TranscriptionResult from './components/TranscriptionResult';
import RecordButton from './components/RecordButton';
import SettingsModal from './components/SettingsModal';
import RecordingsList from './components/RecordingsList';
import { subscribeRecordingToggle, reportRecordingStatus, writeDesktopClipboard, createSpaceReleaseHandlers, pasteTranscript } from './services/shortcutService';
import {
  getAppearanceConfig,
  subscribeAppearanceUpdates,
  playSoundFeedback,
  applyAppearanceToDOM,
  AppearanceConfig,
} from './services/appearanceService';

const DEFAULT_UPDATER_STATE: UpdaterState = {
  status: 'idle',
  message: '',
  progressPercent: 0,
  availableVersion: null,
  currentVersion: 'unknown',
};

const App: React.FC = () => {
  const [status, setStatus] = useState<RecorderStatus>(RecorderStatus.IDLE);
  const [isMiniMode, setIsMiniMode] = useState<boolean>(false);

  const toggleMiniMode = async () => {
    const newMode = !isMiniMode;
    setIsMiniMode(newMode);
    if ((window as any).electronAPI?.toggleMiniMode) {
      await (window as any).electronAPI.toggleMiniMode(newMode);
    }
  };

  const closeWindow = () => {
    if ((window as any).electronAPI?.closeWindow) {
      (window as any).electronAPI.closeWindow();
    }
  };

  const minimizeWindow = () => {
    if ((window as any).electronAPI?.minimizeWindow) {
      (window as any).electronAPI.minimizeWindow();
    }
  };

  const [geminiHealth, setGeminiHealth] = useState<{ status: string, detail?: string } | null>(null);
  const [refreshingHealth, setRefreshingHealth] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [copyError, setCopyError] = useState<boolean>(false);
  const [deliveryNotice, setDeliveryNotice] = useState('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [mode, setMode] = useState<TranscriptionMode>('general');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [quotaConfig, setQuotaConfig] = useState(() => getQuotaConfig() || DEFAULT_QUOTA_CONFIG);
  const [updaterState, setUpdaterState] = useState<UpdaterState>(DEFAULT_UPDATER_STATE);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState<boolean>(false);
  const [appearance, setAppearance] = useState<AppearanceConfig>(() => {
    const cfg = getAppearanceConfig();
    applyAppearanceToDOM(cfg);
    return cfg;
  });

  useEffect(() => {
    return subscribeAppearanceUpdates((updated) => {
      setAppearance(updated);
    });
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const currentAudioBlobRef = useRef<Blob | null>(null);
  const startingRecordingRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const toggleRecordingRef = useRef<() => void>(() => {});

  useEffect(() => subscribeRecordingToggle(() => toggleRecordingRef.current()), []);
  useEffect(() => reportRecordingStatus(error ? 'ERROR' : status), [status, error]);

  // Cleanup stream on unmount or change
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Timer logic
  useEffect(() => {
    let intervalId: number;
    if (status === RecorderStatus.RECORDING) {
      intervalId = window.setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [status]);

  // Load key from storage on mount
  useEffect(() => {
    const readElectronEnv = (key: string): string => {
      const env = window.electronEnv as any;
      if (typeof env?.[key] === 'string') return env[key];
      if (typeof env?.get === 'function') {
        const value = env.get(key);
        return typeof value === 'string' ? value : '';
      }
      return '';
    };

    const storedKey = (localStorage.getItem('VITE_GEMINI_API_KEY') || '').trim();
    const envKey = (
      readElectronEnv('GEMINI_API_KEY')
      || readElectronEnv('VITE_GEMINI_API_KEY')
      || ''
    ).trim();
    const keyToUse = storedKey || envKey;

    const storedModel = (localStorage.getItem('VITE_GEMINI_MODEL') || '').trim();
    const envModel = (
      readElectronEnv('GEMINI_MODEL')
      || readElectronEnv('VITE_GEMINI_MODEL')
      || ''
    ).trim();
    const modelToUse = storedModel || envModel;

    if (keyToUse) {
      setGeminiApiKey(keyToUse);
      if (!storedKey) {
        localStorage.setItem('VITE_GEMINI_API_KEY', keyToUse);
      }
    }

    if (modelToUse) {
      setGeminiModel(modelToUse);
      if (!storedModel) {
        localStorage.setItem('VITE_GEMINI_MODEL', modelToUse);
      }
    }
  }, []);

  useEffect(() => {
    setQuotaConfig(getQuotaConfig() || DEFAULT_QUOTA_CONFIG);
    return subscribeToQuotaUpdates((updated) => {
      setQuotaConfig(updated);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    getUpdaterState().then((state) => {
      if (mounted) {
        setUpdaterState(state);
      }
    }).catch(() => {
      if (mounted) {
        setUpdaterState({
          ...DEFAULT_UPDATER_STATE,
          status: 'error',
          message: 'Не удалось получить статус обновления.',
        });
      }
    });

    const unsubscribe = subscribeUpdaterState((state) => {
      if (mounted) {
        setUpdaterState(state);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Health check on mount
  useEffect(() => {
    let mounted = true;
    checkProviderHealth().then(res => { if (mounted) setGeminiHealth(res as any); }).catch(e => { if (mounted) setGeminiHealth({ status: 'unreachable', detail: String(e) }); });
    return () => { mounted = false };
  }, [isSettingsOpen]);

  const refreshHealth = async () => {
    setRefreshingHealth(true);
    try {
      const res = await checkProviderHealth();
      setGeminiHealth(res as any);
    } catch (e) {
      console.warn('Health refresh error', e);
    } finally {
      setRefreshingHealth(false);
    }
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      const nextState = await checkForUpdates();
      setUpdaterState(nextState);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleDownloadUpdate = async () => {
    const nextState = await downloadUpdate();
    setUpdaterState(nextState);
  };

  const handleInstallUpdate = async () => {
    setIsInstallingUpdate(true);
    try {
      await quitAndInstallUpdate();
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} `;
  };

  const copyToClipboard = useCallback(async (textToCopy: string, autoPaste = false) => {
    setCopyError(false);
    setDeliveryNotice('');

    if (autoPaste) {
      try {
        const result = await pasteTranscript(textToCopy);
        if (result.copied) {
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
          if (!result.pasted) setDeliveryNotice(result.reason === 'clipboard-changed'
            ? 'Буфер обмена изменился до вставки. Скопируйте результат кнопкой «Копировать».'
            : result.reason === 'own-window'
              ? 'Текст скопирован. Для автоматической вставки оставьте активным поле в другом приложении.'
              : 'Текст скопирован. Автовставка не выполнена — нажмите Ctrl+V в нужном поле.');
          return;
        }
      } catch {
        // Continue with ordinary copy if the native delivery bridge fails.
      }
      setDeliveryNotice('Автовставка недоступна. Используйте Ctrl+V после копирования.');
    }

    try {
      if (await writeDesktopClipboard(textToCopy)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        return;
      }
    } catch (err) {
      console.warn('Desktop clipboard failed:', err);
    }

    // Method 1: Async Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        return;
      } catch (err) {
        console.warn('Clipboard API failed, attempting fallback:', err);
      }
    }

    // Method 2: Fallback using execCommand
    try {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "0";
      textArea.style.top = "0";
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        throw new Error("execCommand returned false");
      }
    } catch (err) {
      console.error('All copy methods failed:', err);
      setCopyError(true);
      setTimeout(() => setCopyError(false), 5000);
    }
  }, []);

  const startRecording = async () => {
    if (startingRecordingRef.current || statusRef.current === RecorderStatus.RECORDING || statusRef.current === RecorderStatus.PROCESSING) return;
    startingRecordingRef.current = true;
    setError(null);
    setText("");
    setCopied(false);
    setCopyError(false);
    setDeliveryNotice('');
    setElapsedTime(0);
    setLastProvider(null);

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const options: MediaRecorderOptions = {
        mimeType,
        audioBitsPerSecond: 24000 // Optimized for voice (was 64000)
      };

      const mediaRecorder = new MediaRecorder(audioStream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        currentAudioBlobRef.current = audioBlob;
        handleTranscription(audioBlob);

        audioStream.getTracks().forEach(track => track.stop());
        setStream(null);
      };

      mediaRecorder.start();
      playSoundFeedback('start');
      statusRef.current = RecorderStatus.RECORDING;
      setStatus(RecorderStatus.RECORDING);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Доступ к микрофону запрещен. Пожалуйста, разрешите доступ к микрофону.");
      setStatus(RecorderStatus.IDLE);
    } finally {
      startingRecordingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording' && statusRef.current === RecorderStatus.RECORDING) {
      playSoundFeedback('stop');
      statusRef.current = RecorderStatus.PROCESSING;
      mediaRecorderRef.current.stop();
      setStatus(RecorderStatus.PROCESSING);
    }
  };

  toggleRecordingRef.current = () => {
    if (startingRecordingRef.current) return;
    if (statusRef.current === RecorderStatus.RECORDING) stopRecording();
    else if (statusRef.current !== RecorderStatus.PROCESSING) void startRecording();
  };

  // Hotkeys: Space to toggle recording
  useEffect(() => {
    const handlers = createSpaceReleaseHandlers(() => toggleRecordingRef.current(), e =>
      e.defaultPrevented || isSettingsOpen || isHistoryOpen || Boolean((e.target as HTMLElement)?.isContentEditable)
      || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes((e.target as HTMLElement)?.tagName));
    window.addEventListener('keydown', handlers.keydown);
    window.addEventListener('keyup', handlers.keyup);
    window.addEventListener('blur', handlers.blur);
    return () => {
      window.removeEventListener('keydown', handlers.keydown);
      window.removeEventListener('keyup', handlers.keyup);
      window.removeEventListener('blur', handlers.blur);
    };
  }, [isSettingsOpen, isHistoryOpen]);

  const handleTranscription = async (audioBlob: Blob, autoPaste = true) => {
    try {
      setStatus(RecorderStatus.PROCESSING);
      const result = await transcribeAudio(audioBlob, mode);

      setText(result.text);
      setLastProvider(result.provider);
      if (appearance.autoCopy) {
        await copyToClipboard(result.text, autoPaste);
      }
      setStatus(RecorderStatus.COMPLETED);

      try {
        await saveRecording(audioBlob, result.text, {
          mode,
          provider: result.provider,
          duration: elapsedTime,
        });
      } catch (saveErr) {
        console.error('Failed to save recording:', saveErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла неизвестная ошибка");
      setStatus(RecorderStatus.IDLE);
    }
  };


  const handleRetranscribe = (audioBlob: Blob, recordingId: number) => {
    // Reset state and re-transcribe with current settings (or overridden tone)
    setText("");
    setError(null);
    setCopied(false);
    setLastProvider(null);
    currentAudioBlobRef.current = audioBlob;
    handleTranscription(audioBlob, false);
  };

  return (
    <div
      className={`h-screen text-white flex flex-col overflow-hidden transition-all duration-300 ${isMiniMode ? 'p-0 bg-transparent' : 'p-4 rounded-[24px]'}`}
      style={{
        background: isMiniMode ? 'transparent' : 'var(--theme-bg-gradient)',
      }}
    >
      <div className={`w-full flex-1 ${isMiniMode ? 'flex flex-col h-full bg-transparent' : 'max-w-6xl mx-auto flex flex-col'}`}>

        {isMiniMode ? (
          /* ================= MINI MODE (FLOATING ICON) ================= */
          <div className="w-full h-full flex items-center justify-center drag-area relative group animate-scale-in">
            {/* Background Blur Circle for contrast */}
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full scale-75 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="no-drag z-10 relative">
              <RecordButton
                status={status}
                onClick={status === RecorderStatus.RECORDING ? stopRecording : startRecording}
                size="normal" // 80px matches the 100x100 window well with margins
              />

              {/* Optional tiny indicator for processing */}
              {status === RecorderStatus.PROCESSING && (
                <div className="absolute -top-1 -right-1">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping"></div>
                </div>
              )}
            </div>

            {/* Float-over Control for Mini-mode */}
            <button
              onClick={toggleMiniMode}
              className="absolute top-0 right-0 p-1 bg-white/10 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all no-drag hover:bg-blue-500/40 z-20 m-1 border border-white/10"
              title="Развернуть"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ================= NORMAL MODE UI ================= */
          <div className="flex-1 flex flex-col gap-4 h-full relative">

            {/* Custom Frameless Title Bar */}
            <div className="absolute top-0 left-0 right-0 h-8 drag-area z-50 flex justify-end items-center px-2 gap-1 pointer-events-none">
              <button
                onClick={minimizeWindow}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors no-drag pointer-events-auto text-gray-400 hover:text-white"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={closeWindow}
                className="p-1.5 hover:bg-red-500/20 rounded-md transition-colors no-drag pointer-events-auto text-gray-400 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Header */}
            <header className="glass rounded-2xl p-4 border border-white/10 relative overflow-hidden mt-6">
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{ background: 'var(--theme-header-glow)' }}
              ></div>
              <div className="relative flex items-center justify-between">
                <div className="drag-area flex-1 cursor-default">
                  <h1
                    className="text-2xl font-bold bg-clip-text text-transparent transition-all duration-300"
                    style={{ backgroundImage: 'var(--theme-title-gradient)' }}
                  >
                    Voice Scribe
                  </h1>
                  <p className="text-gray-500 text-xs mt-0.5">Транскрибация RU/EN • Автокопирование</p>
                </div>
                <div className="flex gap-2 no-drag">
                  <button
                    onClick={toggleMiniMode}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-all border border-white/5 hover:border-blue-500/30"
                    title="Мини-режим"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsHistoryOpen(true)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-purple-500/20 text-gray-400 hover:text-purple-400 transition-all border border-white/5 hover:border-purple-500/30"
                    title="История"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
                    title="Настройки"
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left Panel */}
              <div className="w-72 flex flex-col gap-3 flex-shrink-0">
                {/* Visualizer */}
                <div className="glass rounded-2xl p-4 border border-white/10 h-28 relative overflow-hidden">
                  <div
                    className="absolute inset-0 transition-opacity duration-300"
                    style={{ background: 'var(--theme-header-glow)' }}
                  ></div>
                  {status === RecorderStatus.RECORDING ? (
                    <Visualizer
                      stream={stream}
                      isRecording={true}
                      visualizerStyle={appearance.visualizer}
                      themePreset={appearance.theme}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full opacity-20">
                      <div className="flex gap-1.5 items-end">
                        {[16, 28, 20, 32, 24, 36, 20, 28].map((h, i) => (
                          <div
                            key={i}
                            className="w-1.5 rounded-full transition-all duration-300"
                            style={{
                              height: `${h}px`,
                              background: 'var(--theme-title-gradient)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {status === RecorderStatus.RECORDING && (
                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20">
                      ⏺ {formatTime(elapsedTime)}
                    </div>
                  )}
                </div>

                {/* Mode Selector */}
                <div className="glass rounded-2xl p-4 border border-white/10">
                  <label className="text-[10px] font-bold text-gray-500 mb-2 block uppercase tracking-widest">
                    Режим
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['general', 'corrector', 'translator'] as TranscriptionMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        style={mode === m ? {
                          backgroundColor: 'var(--theme-mode-active-bg)',
                          borderColor: 'var(--theme-mode-active-border)',
                          color: 'var(--theme-mode-active)',
                        } : undefined}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${mode === m
                          ? 'border shadow-sm'
                          : 'bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10 border border-transparent'
                          }`}
                      >
                        {m === 'general' ? '📝 Общий' : m === 'corrector' ? '✏️ Корректор' : '🌍 Перевод'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Record Button */}
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <RecordButton
                    status={status}
                    onClick={status === RecorderStatus.RECORDING ? stopRecording : startRecording}
                    size="large"
                  />
                  <div className="h-5 text-center">
                    {status === RecorderStatus.RECORDING && <span className="text-red-400 text-xs animate-pulse">● Запись...</span>}
                    {status === RecorderStatus.PROCESSING && <span className="text-blue-400 text-xs animate-pulse">● Обработка...</span>}
                    {error && <span className="text-red-400 text-[10px]">{error}</span>}
                  </div>
                </div>
              </div>

              {/* Right Panel - Result */}
              <div className="flex-1 glass rounded-2xl p-5 border border-white/10 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <TranscriptionResult
                    text={text}
                    status={status}
                    copied={copied}
                    onManualCopy={() => text && copyToClipboard(text)}
                    fontSize={appearance.fontSize}
                  />
                  {deliveryNotice && <p role="status" className="mt-2 text-xs text-amber-300">{deliveryNotice}</p>}
                </div>
                {lastProvider && (
                  <div className="mt-3 pt-3 border-t border-white/5 text-center text-[10px] text-gray-600">
                    Провайдер: <span className="text-blue-400">{lastProvider}</span>
                    {text && <span className="ml-2 text-green-400">✓ Готово</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <footer className="glass rounded-2xl p-3 border border-white/10">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5" title={geminiHealth?.detail}>
                    <span className="text-gray-600">{getTranscriptionProvider() === 'yandex' ? 'Yandex SpeechKit' : getGeminiModel()}:</span>
                    <HealthDot status={geminiHealth?.status} />
                    <span className="text-gray-500 capitalize">{geminiHealth?.status === 'configured' ? 'Настроен' : geminiHealth?.status || '—'}</span>
                  </div>
                  {getTranscriptionProvider() === 'gemini' && <><div className="h-3 w-px bg-white/10"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">Квота:</span>
                    <span className="text-gray-400">
                      {getRemainingQuota(quotaConfig)} / {quotaConfig.dailyLimit} токенов
                    </span>
                    <span className="text-gray-500">({Math.round(getQuotaPercentage(quotaConfig))}%)</span>
                  </div></>}
                </div>
                <button
                  onClick={refreshHealth}
                  disabled={refreshingHealth}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-all"
                >
                  <RotateCw className={`w-3 h-3 ${refreshingHealth ? 'animate-spin' : ''}`} />
                  {refreshingHealth ? 'Обновление...' : 'Обновить'}
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        updaterState={updaterState}
        isCheckingUpdates={isCheckingUpdates}
        isInstallingUpdate={isInstallingUpdate}
        onCheckUpdates={handleCheckUpdates}
        onDownloadUpdate={handleDownloadUpdate}
        onInstallUpdate={handleInstallUpdate}
      />
      <RecordingsList
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRetranscribe={handleRetranscribe}
      />
    </div>
  );
};

// Health indicator dot component
const HealthDot: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = (status || '').toLowerCase();
  if (s === 'configured') return <span className="w-2 h-2 inline-block rounded-full bg-blue-400" title="Настройки заполнены; доступ проверяется при обработке записи"></span>;
  if (s === 'ok') return <span className="w-2 h-2 inline-block rounded-full bg-green-400 shadow-lg shadow-green-400/50" title="OK"></span>;
  if (s === 'rate_limit' || s === 'degraded') return <span className="w-2 h-2 inline-block rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" title={status ?? undefined}></span>;
  if (s === 'auth' || s === 'unreachable') return <span className="w-2 h-2 inline-block rounded-full bg-red-500 shadow-lg shadow-red-500/50" title={status ?? undefined}></span>;
  return <span className="w-2 h-2 inline-block rounded-full bg-gray-600" title="unknown"></span>;
};

export default App;
