import React, { useState, useEffect } from 'react';
import { Palette, Volume2, Copy, Layers, Check, Sparkles } from 'lucide-react';
import CustomSelect, { SelectOption } from './CustomSelect';
import {
    getAppearanceConfig,
    updateAppearanceConfig,
    subscribeAppearanceUpdates,
    playSoundFeedback,
    ThemePreset,
    VisualizerPreset,
    FontSizePreset,
} from '../services/appearanceService';

const VISUALIZER_OPTIONS: SelectOption[] = [
    {
        value: 'waves',
        label: 'Плавные волны',
        description: 'Плавная динамическая волна амплитуды голоса',
        badge: 'По умолчанию',
        badgeColor: 'blue',
    },
    {
        value: 'bars',
        label: 'Спектральный эквалайзер',
        description: 'Классические частотные полосы с подсветкой',
        badge: 'Классика',
        badgeColor: 'purple',
    },
    {
        value: 'minimal',
        label: 'Минималистичный пульс',
        description: 'Лаконичный индикатор для сосредоточенной работы',
        badge: 'Минимализм',
        badgeColor: 'gray',
    },
];

const FONT_SIZE_OPTIONS: SelectOption[] = [
    {
        value: 'sm',
        label: 'Компактный (14px)',
        description: 'Умещает больше текста на одном экране',
    },
    {
        value: 'md',
        label: 'Стандартный (16px)',
        description: 'Рекомендуемый размер с оптимальным балансом',
        badge: 'Стандарт',
        badgeColor: 'blue',
    },
    {
        value: 'lg',
        label: 'Крупный (18px)',
        description: 'Повышенная читаемость с большого расстояния',
    },
];

interface ThemeItem {
    id: string;
    title: string;
    subtitle: string;
    gradient: string;
    border: string;
    accent: string;
}

const THEMES: ThemeItem[] = [
    {
        id: 'dark',
        title: 'Глубокая ночь',
        subtitle: 'Obsidian & Purple glow',
        gradient: 'from-[#0b0b12] to-[#17112b]',
        border: 'border-purple-500/40',
        accent: 'bg-purple-500',
    },
    {
        id: 'midnight',
        title: 'Космос (Midnight)',
        subtitle: 'Deep Navy & Sapphire',
        gradient: 'from-[#080d1a] to-[#0f1f3d]',
        border: 'border-blue-500/40',
        accent: 'bg-blue-500',
    },
    {
        id: 'cyberpunk',
        title: 'Неон (Cyberpunk)',
        subtitle: 'Electric Cyan & Magenta',
        gradient: 'from-[#0d091a] to-[#260f38]',
        border: 'border-pink-500/40',
        accent: 'bg-pink-500',
    },
];

export default function AppearanceSettings() {
    const [config, setConfig] = useState(() => getAppearanceConfig());
    const [theme, setTheme] = useState<ThemePreset>(config.theme);
    const [visualizer, setVisualizer] = useState<VisualizerPreset>(config.visualizer);
    const [fontSize, setFontSize] = useState<FontSizePreset>(config.fontSize);
    const [autoCopy, setAutoCopy] = useState<boolean>(config.autoCopy);
    const [soundFeedback, setSoundFeedback] = useState<boolean>(config.soundFx);
    const [savedNotification, setSavedNotification] = useState(false);

    useEffect(() => {
        const initial = getAppearanceConfig();
        setConfig(initial);
        setTheme(initial.theme);
        setVisualizer(initial.visualizer);
        setFontSize(initial.fontSize);
        setAutoCopy(initial.autoCopy);
        setSoundFeedback(initial.soundFx);

        return subscribeAppearanceUpdates((updated) => {
            setConfig(updated);
            setTheme(updated.theme);
            setVisualizer(updated.visualizer);
            setFontSize(updated.fontSize);
            setAutoCopy(updated.autoCopy);
            setSoundFeedback(updated.soundFx);
        });
    }, []);

    const handleThemeChange = (id: string) => {
        const themeId = id as ThemePreset;
        setTheme(themeId);
        updateAppearanceConfig({ theme: themeId });
        triggerSaved();
    };

    const handleVisualizerChange = (val: string) => {
        const viz = val as VisualizerPreset;
        setVisualizer(viz);
        updateAppearanceConfig({ visualizer: viz });
        triggerSaved();
    };

    const handleFontSizeChange = (val: string) => {
        const size = val as FontSizePreset;
        setFontSize(size);
        updateAppearanceConfig({ fontSize: size });
        triggerSaved();
    };

    const handleAutoCopyToggle = () => {
        const next = !autoCopy;
        setAutoCopy(next);
        updateAppearanceConfig({ autoCopy: next });
        triggerSaved();
    };

    const handleSoundToggle = () => {
        const next = !soundFeedback;
        setSoundFeedback(next);
        updateAppearanceConfig({ soundFx: next });
        if (next) {
            playSoundFeedback('start');
        }
        triggerSaved();
    };

    const triggerSaved = () => {
        setSavedNotification(true);
        setTimeout(() => setSavedNotification(false), 2000);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Theme selection */}
            <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                    Цветовая палитра оформления
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {THEMES.map((item) => {
                        const isSelected = theme === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleThemeChange(item.id)}
                                className={`relative p-3.5 rounded-2xl text-left transition-all group overflow-hidden border ${
                                    isSelected
                                        ? `${item.border} bg-white/[0.08] shadow-lg shadow-black/40 ring-1 ring-white/20`
                                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                                }`}
                            >
                                <div
                                    className={`h-12 w-full rounded-xl bg-gradient-to-r ${item.gradient} mb-3 flex items-center justify-center border border-white/10 shadow-inner relative overflow-hidden`}
                                >
                                    <div className="absolute inset-0 bg-black/20" />
                                    <div className="flex gap-1.5 z-10">
                                        <div className={`w-3 h-3 rounded-full ${item.accent} shadow-md`} />
                                        <div className="w-3 h-3 rounded-full bg-white/20" />
                                        <div className="w-3 h-3 rounded-full bg-white/10" />
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/90 text-black flex items-center justify-center">
                                            <Check className="w-2.5 h-2.5" />
                                        </div>
                                    )}
                                </div>
                                <div className="font-medium text-xs text-white truncate">{item.title}</div>
                                <div className="text-[10px] text-gray-400 truncate mt-0.5">{item.subtitle}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Visualizer & Typography dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CustomSelect
                    label="Стиль визуализации записи"
                    value={visualizer}
                    onChange={handleVisualizerChange}
                    options={VISUALIZER_OPTIONS}
                    helperText="Определяет анимацию звуковой дорожки при записи голоса"
                />

                <CustomSelect
                    label="Размер шрифта текста"
                    value={fontSize}
                    onChange={handleFontSizeChange}
                    options={FONT_SIZE_OPTIONS}
                    helperText="Масштаб шрифта в окне распознанного текста"
                />
            </div>

            {/* UX Toggles */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                            <Copy className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Автоматическое копирование</p>
                            <p className="text-xs text-gray-400">
                                Автоматически помещать распознанный текст в буфер обмена Windows сразу после завершения
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleAutoCopyToggle}
                        className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none p-0.5 shrink-0 ${
                            autoCopy ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gray-700/80'
                        }`}
                        aria-pressed={autoCopy}
                    >
                        <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                                autoCopy ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>

                <div className="border-t border-white/5" />

                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                            <Volume2 className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Звуковой сигнал при записи</p>
                            <p className="text-xs text-gray-400">
                                Ненавязчивый звуковой индикатор при старте и окончании фиксации аудио
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSoundToggle}
                        className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none p-0.5 shrink-0 ${
                            soundFeedback ? 'bg-gradient-to-r from-purple-500 to-pink-600' : 'bg-gray-700/80'
                        }`}
                        aria-pressed={soundFeedback}
                    >
                        <div
                            className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                                soundFeedback ? 'translate-x-6' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {savedNotification && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl animate-fade-in">
                    <Check className="w-3.5 h-3.5" />
                    <span>Параметры внешнего вида обновлены</span>
                </div>
            )}
        </div>
    );
}

