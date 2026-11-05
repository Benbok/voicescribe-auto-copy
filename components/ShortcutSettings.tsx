import React, { useEffect, useState, useRef } from 'react';
import { Keyboard, Command, Check, RotateCcw, AlertCircle, Info, Sparkles } from 'lucide-react';
import type { RecordingShortcutState } from '../types';
import {
    DEFAULT_RECORDING_SHORTCUT,
    displayShortcut,
    getRecordingShortcut,
    setRecordingShortcut,
    shortcutFromEvent,
    subscribeShortcutState,
} from '../services/shortcutService';

export default function ShortcutSettings() {
    const [state, setState] = useState<RecordingShortcutState | null>(null);
    const [draft, setDraft] = useState(DEFAULT_RECORDING_SHORTCUT);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let mounted = true;
        getRecordingShortcut()
            .then((value) => {
                if (mounted) {
                    setState(value);
                    setDraft(value.accelerator);
                }
            })
            .catch(() => {
                if (mounted) setMessage('Не удалось загрузить сочетание клавиш.');
            });
        const unsubscribe = subscribeShortcutState((value) => {
            if (mounted) setState(value);
        });
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const save = async () => {
        if (saving) return;
        setSaving(true);
        setMessage('');
        try {
            const value = await setRecordingShortcut(draft);
            setState(value);
            setDraft(value.accelerator);
            setMessage('Сочетание сохранено и действует во всех окнах системы.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Не удалось сохранить сочетание.');
        } finally {
            setSaving(false);
        }
    };

    const keysArray = displayShortcut(draft).split('+').map((k) => k.trim());

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header info */}
            <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-500/[0.08] to-transparent p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                            <Keyboard className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Глобальная горячая клавиша</h3>
                            <p className="text-xs text-blue-300/80">Работает поверх любых запущенных программ</p>
                        </div>
                    </div>
                    {state && (
                        <span
                            className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${
                                state.registered
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                        >
                            {state.registered ? '✓ Активна' : state.error || 'Регистрация...'}
                        </span>
                    )}
                </div>

                <div className="space-y-3">
                    <label
                        htmlFor="recording-shortcut"
                        className="block text-xs font-semibold text-gray-300 uppercase tracking-wider"
                    >
                        Нажмите для изменения сочетания
                    </label>

                    {/* Interactive Shortcut Box */}
                    <div
                        onClick={() => inputRef.current?.focus()}
                        className={`relative w-full p-4 rounded-2xl glass border transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 ${
                            isCapturing
                                ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/20 bg-blue-950/30'
                                : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                        }`}
                    >
                        <div className="flex items-center gap-2 flex-wrap">
                            {keysArray.map((keyName, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <span className="text-gray-500 text-sm font-bold">+</span>}
                                    <kbd className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-white/10 to-white/5 border border-white/20 shadow-md text-white font-mono text-sm font-semibold tracking-wide flex items-center gap-1.5 shadow-black/40">
                                        {keyName === 'Win' && <Command className="w-3.5 h-3.5 text-blue-400" />}
                                        {keyName}
                                    </kbd>
                                </React.Fragment>
                            ))}
                        </div>

                        <div className="text-xs text-gray-400 flex items-center gap-2">
                            {isCapturing ? (
                                <span className="text-blue-400 animate-pulse font-medium">
                                    ● Нажмите клавиши на клавиатуре...
                                </span>
                            ) : (
                                <span className="text-gray-500">Кликните для записи</span>
                            )}
                        </div>

                        {/* Hidden input to capture keystrokes cleanly */}
                        <input
                            ref={inputRef}
                            id="recording-shortcut"
                            value={displayShortcut(draft)}
                            readOnly
                            disabled={saving}
                            onFocus={() => setIsCapturing(true)}
                            onBlur={() => setIsCapturing(false)}
                            onKeyDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const value = shortcutFromEvent(event.nativeEvent);
                                if (value) {
                                    setDraft(value);
                                    setMessage('');
                                }
                            }}
                            className="sr-only"
                        />
                    </div>

                    <p className="text-xs text-gray-400">
                        Для использования сочетания <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 font-mono text-[10px]">Win+Alt</kbd> без третьей клавиши выберите кнопку «Сбросить на Win+Alt».
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                            setDraft(DEFAULT_RECORDING_SHORTCUT);
                            setMessage('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 transition-colors flex items-center gap-1.5 interactive disabled:opacity-50"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Сбросить на Win+Alt
                    </button>

                    <button
                        type="button"
                        disabled={saving || !state || draft === state.accelerator}
                        onClick={() => void save()}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition-all flex items-center gap-1.5 interactive disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-3.5 h-3.5" />
                        {saving ? 'Сохранение...' : 'Применить сочетание'}
                    </button>
                </div>

                {message && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-xs text-blue-300 animate-fade-in">
                        <Info className="w-3.5 h-3.5 shrink-0" />
                        <span>{message}</span>
                    </div>
                )}
            </div>

            {/* Practical tips */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5 text-xs text-gray-400">
                <div className="flex items-center gap-2 text-gray-300 font-medium">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Быстрые подсказки по управлению:</span>
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-gray-400 pl-1 leading-relaxed">
                    <li><strong className="text-gray-300">Пробел</strong> — переключает запись в главном окне приложения.</li>
                    <li><strong className="text-gray-300">Крестик окна</strong> — сворачивает приложение в системный трей (фоновый режим).</li>
                    <li><strong className="text-gray-300">Красный значок в трее</strong> — наглядно информирует об активной записи микрофона.</li>
                </ul>
            </div>
        </div>
    );
}
