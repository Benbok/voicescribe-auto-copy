import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    Check,
    AlertCircle,
    Loader2,
    Key,
    Palette,
    Keyboard,
    Zap,
    Download,
    RefreshCw,
    Sliders,
    Eye,
    EyeOff,
    Trash2,
    Sparkles,
    ShieldCheck,
    Cloud,
    Info,
} from 'lucide-react';
import { setGeminiApiKey, setGeminiModel, getGeminiModel } from '../services/geminiService';
import { validateGeminiApiKey } from '../services/geminiKeyValidation';
import {
    DEFAULT_QUOTA_CONFIG,
    getQuotaConfig,
    setQuotaConfig,
    getQuotaPercentage,
    getQuotaWarning,
    subscribeToQuotaUpdates,
} from '../services/quotaService';
import type { UpdaterState, TranscriptionProvider } from '../types';
import { getTranscriptionProvider, setTranscriptionProvider } from '../services/transcriptionService';
import { getYandexConfig, saveYandexConfig } from '../services/yandexConfig';
import YandexSettings from './YandexSettings';
import ShortcutSettings from './ShortcutSettings';
import AppearanceSettings from './AppearanceSettings';
import CustomSelect, { SelectOption } from './CustomSelect';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    updaterState: UpdaterState;
    isCheckingUpdates: boolean;
    isInstallingUpdate: boolean;
    onCheckUpdates: () => Promise<void>;
    onDownloadUpdate: () => Promise<void>;
    onInstallUpdate: () => Promise<void>;
}

type TabType = 'api' | 'appearance' | 'shortcuts';

const PROVIDER_OPTIONS: SelectOption[] = [
    {
        value: 'yandex',
        label: 'Yandex Cloud',
        description: 'SpeechKit STT + YandexGPT • Высокая точность распознавания RU',
        badge: 'По умолчанию',
        badgeColor: 'amber',
        icon: <Cloud className="w-4 h-4 text-amber-400" />,
    },
    {
        value: 'gemini',
        label: 'Google Gemini',
        description: 'Gemini 2.5 Flash / Pro • Мультиязычный умный анализ речи',
        badge: 'AI Режим',
        badgeColor: 'blue',
        icon: <Sparkles className="w-4 h-4 text-blue-400" />,
    },
];

const GEMINI_MODEL_OPTIONS: SelectOption[] = [
    {
        value: 'gemini-2.5-flash',
        label: 'gemini-2.5-flash',
        description: 'Быстрая транскрибация с отличным качеством',
        badge: 'Рекомендуется',
        badgeColor: 'blue',
    },
    {
        value: 'gemini-2.5-pro',
        label: 'gemini-2.5-pro',
        description: 'Флагманская модель для сложного контекста и терминологии',
        badge: 'Pro',
        badgeColor: 'purple',
    },
    {
        value: 'gemini-2.0-flash',
        label: 'gemini-2.0-flash',
        description: 'Высокая скорость отклика предыдущего поколения',
        badgeColor: 'gray',
    },
    {
        value: 'gemini-1.5-flash',
        label: 'gemini-1.5-flash',
        description: 'Легковесная базовая модель',
        badgeColor: 'gray',
    },
    {
        value: '__custom__',
        label: 'Своя модель...',
        description: 'Ввести кастомное имя модели вручную',
        badge: 'Своя',
        badgeColor: 'emerald',
    },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    updaterState,
    isCheckingUpdates,
    isInstallingUpdate,
    onCheckUpdates,
    onDownloadUpdate,
    onInstallUpdate,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('api');
    const [provider, setProvider] = useState<TranscriptionProvider>(getTranscriptionProvider);
    const [yandex, setYandex] = useState(() => ({ ...getYandexConfig(), apiKey: '' }));
    const [hasYandexKey, setHasYandexKey] = useState(false);
    const [geminiKey, setGeminiKey] = useState('');
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
    const [keyMessage, setKeyMessage] = useState('');
    const keyCheckId = useRef(0);
    const [geminiModel, setGeminiModelState] = useState(getGeminiModel());
    const [isCustomGeminiModel, setIsCustomGeminiModel] = useState(false);
    const [hasStoredGeminiKey, setHasStoredGeminiKey] = useState(false);
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [msg, setMsg] = useState('');
    const [quotaConfig, setQuotaState] = useState(() => getQuotaConfig() || DEFAULT_QUOTA_CONFIG);
    const [dailyLimit, setDailyLimit] = useState(quotaConfig?.dailyLimit?.toString() || '1500');

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Load from localStorage on open
    useEffect(() => {
        keyCheckId.current += 1;
        setKeyStatus('idle');
        setKeyMessage('');
        setShowGeminiKey(false);
        if (isOpen) {
            const config = getYandexConfig();
            setProvider(getTranscriptionProvider());
            setYandex({ ...config, apiKey: '' });
            setHasYandexKey(Boolean(config.apiKey));
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

            const storedModel = (localStorage.getItem('VITE_GEMINI_MODEL') || '').trim();
            const envModel = (
                readElectronEnv('GEMINI_MODEL')
                || readElectronEnv('VITE_GEMINI_MODEL')
                || ''
            ).trim();

            const hasKey = Boolean(storedKey || envKey);
            const quota = getQuotaConfig();
            const modelToUse = storedModel || envModel || getGeminiModel();

            // Security UX: never prefill API key input with stored value.
            setGeminiKey('');
            setGeminiModelState(modelToUse);
            setHasStoredGeminiKey(hasKey);

            const isStandardModel = GEMINI_MODEL_OPTIONS.some(
                (opt) => opt.value === modelToUse && opt.value !== '__custom__'
            );
            setIsCustomGeminiModel(!isStandardModel && Boolean(modelToUse));

            if (quota) {
                setQuotaState(quota);
                setDailyLimit(quota.dailyLimit.toString());
            }
            setStatus('idle');
            setMsg('');
        }
    }, [isOpen]);

    useEffect(() => {
        return subscribeToQuotaUpdates((updated) => {
            setQuotaState(updated);
        });
    }, []);

    const handleCheckKey = async (): Promise<boolean> => {
        const checkId = ++keyCheckId.current;
        setKeyStatus('checking');
        setKeyMessage('Проверка доступа к серверам Gemini...');
        const result = await validateGeminiApiKey(geminiKey);
        if (checkId !== keyCheckId.current) return false;
        setKeyStatus(result.status);
        setKeyMessage(result.message);
        return result.status === 'ok';
    };

    const handleModelSelect = (selected: string) => {
        if (selected === '__custom__') {
            setIsCustomGeminiModel(true);
        } else {
            setIsCustomGeminiModel(false);
            setGeminiModelState(selected);
        }
    };

    const handleSave = async () => {
        if (status === 'saving' || keyStatus === 'checking') return;
        setStatus('saving');
        setMsg('Сохранение конфигурации...');

        try {
            if (provider === 'yandex') {
                saveYandexConfig({ ...yandex, apiKey: yandex.apiKey.trim() || getYandexConfig().apiKey });
                setTranscriptionProvider('yandex');
                setHasYandexKey(true);
                setYandex((current) => ({ ...current, apiKey: '' }));
                setStatus('success');
                setMsg('Настройки сохранены. Выбран провайдер Yandex Cloud.');
                setTimeout(onClose, 1200);
                return;
            }

            const sanitizedGeminiKey = geminiKey.trim();
            const sanitizedGeminiModel = geminiModel.trim() || 'gemini-2.5-flash';

            // A rejected draft must never replace the working key.
            if (sanitizedGeminiKey) {
                const checkId = keyCheckId.current + 1;
                const valid = await handleCheckKey();
                if (checkId !== keyCheckId.current) return;
                if (!valid) {
                    setStatus('error');
                    setMsg('API-ключ не прошел проверку. Проверьте правильность ключа.');
                    return;
                }
            }

            // Update Services
            if (sanitizedGeminiKey) {
                setGeminiApiKey(sanitizedGeminiKey);
                localStorage.setItem('VITE_GEMINI_API_KEY', sanitizedGeminiKey);
                setHasStoredGeminiKey(true);
            }
            setGeminiModel(sanitizedGeminiModel);
            localStorage.setItem('VITE_GEMINI_MODEL', sanitizedGeminiModel);
            setTranscriptionProvider('gemini');

            // Save quota config
            const limit = parseInt(dailyLimit) || 1500;
            const updatedQuota = setQuotaConfig({ dailyLimit: limit });
            setQuotaState(updatedQuota);
            setDailyLimit(updatedQuota.dailyLimit.toString());

            setStatus('success');
            setMsg(sanitizedGeminiKey ? 'Настройки Gemini успешно сохранены!' : 'Модель и лимит сохранены. API-ключ не менялся.');
            setTimeout(onClose, 1200);
        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setMsg(err.message || 'Не удалось сохранить настройки');
        }
    };

    const handleClearGeminiKey = () => {
        keyCheckId.current += 1;
        setKeyStatus('idle');
        setKeyMessage('');
        localStorage.removeItem('VITE_GEMINI_API_KEY');
        setGeminiKey('');
        setHasStoredGeminiKey(false);
        setStatus('success');
        setMsg('Сохраненный API-ключ Gemini успешно удален.');
    };

    if (!isOpen) return null;

    const currentGeminiModelValue = isCustomGeminiModel
        ? '__custom__'
        : geminiModel || 'gemini-2.5-flash';

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-[100] no-drag flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="glass-strong border border-white/15 rounded-3xl w-full max-w-2xl max-h-[calc(100vh-2.5rem)] shadow-2xl shadow-black/90 relative animate-scale-in flex flex-col overflow-hidden no-drag"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between relative bg-gradient-to-r from-white/[0.04] via-transparent to-white/[0.02]">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-white/15 flex items-center justify-center text-blue-400 shadow-inner">
                            <Sliders className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-white tracking-tight">Настройки</h2>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-gray-300 font-mono">
                                    v{updaterState.currentVersion || '0.0.4'}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">
                                Управление распознаванием, ключами доступа и интерфейсом
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        type="button"
                        aria-label="Закрыть настройки"
                        className="no-drag w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white transition-all rounded-xl hover:bg-white/10 border border-transparent hover:border-white/15 cursor-pointer relative z-20 shrink-0 interactive"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Segmented Tab Navigation */}
                <div className="px-6 pt-4 pb-2">
                    <div className="flex p-1 bg-white/[0.03] border border-white/[0.08] rounded-2xl gap-1">
                        {[
                            { id: 'api' as TabType, label: 'API и Модели', icon: Key },
                            { id: 'appearance' as TabType, label: 'Внешний вид', icon: Palette },
                            { id: 'shortcuts' as TabType, label: 'Горячие клавиши', icon: Keyboard },
                        ].map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 ${
                                        isActive
                                            ? 'bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30 text-white border border-blue-500/30 shadow-md shadow-blue-950/40'
                                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-6 min-h-0 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    {/* API & Providers Tab */}
                    {activeTab === 'api' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Provider Dropdown */}
                            <div className="space-y-2">
                                <CustomSelect
                                    label="Основной провайдер распознавания"
                                    value={provider}
                                    disabled={status === 'saving' || keyStatus === 'checking'}
                                    onChange={(val) => {
                                        setProvider(val as TranscriptionProvider);
                                        setStatus('idle');
                                        setMsg('');
                                    }}
                                    options={PROVIDER_OPTIONS}
                                    helperText="Выберите сервис для преобразования голоса в текст и последующей обработки."
                                />
                            </div>

                            {/* Provider Content */}
                            {provider === 'yandex' && (
                                <YandexSettings
                                    value={yandex}
                                    hasKey={hasYandexKey}
                                    disabled={status === 'saving'}
                                    onChange={setYandex}
                                />
                            )}

                            {provider === 'gemini' && (
                                <div className="space-y-5">
                                    {/* Gemini API Key Box */}
                                    <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-b from-blue-500/[0.08] to-transparent p-5 space-y-4 shadow-lg shadow-blue-950/20 backdrop-blur-md animate-fade-in">
                                        <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                                    <Key className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-white">Gemini API Key</h3>
                                                    <p className="text-xs text-blue-300/80">Google AI Studio</p>
                                                </div>
                                            </div>
                                            <span
                                                className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${
                                                    hasStoredGeminiKey
                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                }`}
                                            >
                                                {hasStoredGeminiKey ? '✓ Ключ сохранён' : 'Требуется ключ'}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="relative">
                                                <input
                                                    type={showGeminiKey ? 'text' : 'password'}
                                                    value={geminiKey}
                                                    disabled={status === 'saving' || keyStatus === 'checking'}
                                                    onChange={(e) => {
                                                        setGeminiKey(e.target.value);
                                                        setKeyStatus('idle');
                                                        setKeyMessage('');
                                                        setStatus('idle');
                                                        setMsg('');
                                                    }}
                                                    placeholder={hasStoredGeminiKey ? 'Ключ уже сохранен. Введите новый для замены' : 'AIzaSy... (Gemini API Key)'}
                                                    className="w-full glass bg-gray-950/60 border border-blue-500/30 rounded-xl px-4 py-3 pr-20 text-sm text-white placeholder:text-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all font-mono"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                    {keyStatus === 'ok' && (
                                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                                                        disabled={status === 'saving' || keyStatus === 'checking'}
                                                        tabIndex={-1}
                                                        className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
                                                        title={showGeminiKey ? 'Скрыть ключ' : 'Показать ключ'}
                                                    >
                                                        {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-3 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => { void handleCheckKey(); }}
                                                    disabled={!geminiKey.trim() || keyStatus === 'checking' || status === 'saving'}
                                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all interactive"
                                                >
                                                    {keyStatus === 'checking' ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            Проверка доступа...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShieldCheck className="w-3.5 h-3.5" />
                                                            Проверить ключ
                                                        </>
                                                    )}
                                                </button>

                                                {hasStoredGeminiKey && (
                                                    <button
                                                        type="button"
                                                        onClick={handleClearGeminiKey}
                                                        disabled={status === 'saving' || keyStatus === 'checking'}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-colors interactive"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Удалить ключ
                                                    </button>
                                                )}
                                            </div>

                                            {keyMessage && (
                                                <div
                                                    role="status"
                                                    className={`text-xs p-2.5 rounded-xl border flex items-center gap-2 ${
                                                        keyStatus === 'error'
                                                            ? 'bg-red-500/10 text-red-300 border-red-500/30'
                                                            : keyStatus === 'ok'
                                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                                            : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                                    }`}
                                                >
                                                    <Info className="w-3.5 h-3.5 shrink-0" />
                                                    <span>{keyMessage}</span>
                                                </div>
                                            )}

                                            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                                                <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                Ключ сохраняется в защищенном локальном хранилище только по нажатию кнопки «Сохранить».
                                            </p>
                                        </div>
                                    </div>

                                    {/* Gemini Model Selector */}
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                                        <CustomSelect
                                            label="Модель Gemini"
                                            value={currentGeminiModelValue}
                                            onChange={handleModelSelect}
                                            options={GEMINI_MODEL_OPTIONS}
                                            variant="blue"
                                            helperText="Выберите модель Google Gemini для распознавания аудиофайлов и текстового форматирования."
                                        />

                                        {isCustomGeminiModel && (
                                            <div className="pt-2 animate-scale-in">
                                                <input
                                                    id="gemini-model-custom"
                                                    type="text"
                                                    value={geminiModel}
                                                    disabled={status === 'saving'}
                                                    onChange={(e) => setGeminiModelState(e.target.value)}
                                                    placeholder="gemini-2.5-flash-lite..."
                                                    className="w-full glass bg-gray-950/60 border border-blue-500/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all font-mono"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Quota & Token Limits */}
                                    <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-b from-blue-500/[0.05] to-transparent p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                                    <Zap className="w-4 h-4" />
                                                </div>
                                                <h4 className="text-sm font-semibold text-white">Лимиты токенов Gemini</h4>
                                            </div>
                                            <span className="text-xs text-blue-300 font-mono">
                                                {quotaConfig?.usedToday || 0} / {quotaConfig?.dailyLimit || 1500} токенов
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="space-y-1.5">
                                            <div className="w-full h-2.5 bg-gray-800/80 rounded-full overflow-hidden p-0.5 border border-white/5">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                                                        (quotaConfig?.usedToday || 0) / (quotaConfig?.dailyLimit || 1500) > 0.9
                                                            ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-500/50'
                                                            : (quotaConfig?.usedToday || 0) / (quotaConfig?.dailyLimit || 1500) > 0.75
                                                            ? 'bg-gradient-to-r from-yellow-500 to-amber-600 shadow-yellow-500/50'
                                                            : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/50'
                                                    }`}
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            ((quotaConfig?.usedToday || 0) / (quotaConfig?.dailyLimit || 1500)) * 100
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[11px] text-gray-400">
                                                <span>
                                                    Осталось:{' '}
                                                    <strong className="text-gray-200">
                                                        {Math.max(0, (quotaConfig?.dailyLimit || 1500) - (quotaConfig?.usedToday || 0))}
                                                    </strong>{' '}
                                                    токенов
                                                </span>
                                                <span>{Math.round(getQuotaPercentage(quotaConfig))}% исчерпано</span>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                                                <div className="text-[10px] uppercase font-semibold text-gray-400">Входящие токены (Audio)</div>
                                                <div className="text-base font-bold text-blue-300 font-mono mt-0.5">
                                                    {quotaConfig?.categories?.input || 0}
                                                </div>
                                            </div>
                                            <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                                                <div className="text-[10px] uppercase font-semibold text-gray-400">Исходящие токены (Text)</div>
                                                <div className="text-base font-bold text-emerald-300 font-mono mt-0.5">
                                                    {quotaConfig?.categories?.output || 0}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Daily Limit Configuration */}
                                        <div className="space-y-2 pt-2 border-t border-white/5">
                                            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                                                Дневной лимит токенов
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={dailyLimit}
                                                    onChange={(e) => setDailyLimit(e.target.value)}
                                                    placeholder="1500"
                                                    min="100"
                                                    max="50000"
                                                    className="flex-1 glass bg-gray-950/60 border border-blue-500/30 rounded-xl px-4 py-2.5 text-sm text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all font-mono"
                                                />
                                                <div className="flex gap-1.5">
                                                    {['1500', '5000', '15000'].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => setDailyLimit(preset)}
                                                            className={`px-2.5 py-2 rounded-xl text-xs font-mono border transition-all ${
                                                                dailyLimit === preset
                                                                    ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                                                                    : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                                                            }`}
                                                        >
                                                            {preset}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {quotaConfig && getQuotaWarning(quotaConfig) && (
                                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 shrink-0" />
                                                <span>{getQuotaWarning(quotaConfig)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* App Updates Section */}
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300">
                                            <RefreshCw className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-white">Обновления приложения</h4>
                                            <p className="text-xs text-gray-400">
                                                Текущая версия:{' '}
                                                <span className="text-gray-200 font-mono">v{updaterState.currentVersion}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => void onCheckUpdates()}
                                        disabled={isCheckingUpdates}
                                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all interactive flex items-center gap-1.5"
                                    >
                                        {isCheckingUpdates ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        )}
                                        <span>Проверить</span>
                                    </button>
                                </div>

                                <p className="text-xs text-gray-400">
                                    {updaterState.message || 'Проверка обновлений выполняется автоматически.'}
                                </p>

                                {updaterState.status === 'downloading' && (
                                    <div className="space-y-1.5">
                                        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
                                                style={{
                                                    width: `${Math.max(0, Math.min(100, updaterState.progressPercent))}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-[11px] text-blue-300 text-right font-mono">
                                            {Math.round(updaterState.progressPercent)}%
                                        </p>
                                    </div>
                                )}

                                {updaterState.status === 'available' && (
                                    <button
                                        onClick={() => void onDownloadUpdate()}
                                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 interactive"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Скачать обновление ({updaterState.availableVersion})
                                    </button>
                                )}

                                {updaterState.status === 'downloaded' && (
                                    <button
                                        onClick={() => void onInstallUpdate()}
                                        disabled={isInstallingUpdate}
                                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 interactive disabled:opacity-50"
                                    >
                                        {isInstallingUpdate ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Check className="w-3.5 h-3.5" />
                                        )}
                                        Перезапустить и установить
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && <AppearanceSettings />}

                    {/* Shortcuts Tab */}
                    {activeTab === 'shortcuts' && <ShortcutSettings />}

                    {/* Feedback Toast */}
                    {status !== 'idle' && (
                        <div
                            className={`flex items-center gap-3 text-sm p-4 rounded-2xl border animate-slide-down ${
                                status === 'error'
                                    ? 'bg-red-500/10 text-red-300 border-red-500/30'
                                    : status === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                    : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            }`}
                        >
                            {status === 'saving' && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                            {status === 'success' && <Check className="w-5 h-5 shrink-0" />}
                            {status === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
                            <span className="font-medium">{msg}</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-white/10 bg-gradient-to-r from-white/[0.02] via-transparent to-white/[0.02] flex items-center justify-between gap-3">
                    <div className="hidden sm:block text-[11px] text-gray-500">
                        Нажмите <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 font-mono text-[10px]">Esc</kbd> для закрытия
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-5 py-2.5 glass border border-white/10 text-gray-300 text-xs font-semibold rounded-xl hover:bg-white/10 hover:text-white transition-all interactive"
                        >
                            {activeTab === 'api' ? 'Отмена' : 'Закрыть'}
                        </button>

                        {activeTab === 'api' && (
                            <button
                                onClick={handleSave}
                                disabled={status === 'saving' || keyStatus === 'checking'}
                                className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all interactive disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === 'saving' ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Сохранение...
                                    </>
                                ) : (
                                    'Сохранить изменения'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
