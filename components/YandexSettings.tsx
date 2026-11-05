import React, { useState } from 'react';
import { Eye, EyeOff, Sparkles, Folder, Key, Info } from 'lucide-react';
import type { YandexConfig } from '../services/yandexConfig';
import CustomSelect, { SelectOption } from './CustomSelect';

interface Props {
    value: YandexConfig;
    hasKey: boolean;
    disabled: boolean;
    onChange: (value: YandexConfig) => void;
}

const YANDEX_MODEL_OPTIONS: SelectOption[] = [
    {
        value: 'yandexgpt/latest',
        label: 'yandexgpt/latest',
        description: 'YandexGPT Pro • Высокая точность пунктуации и коррекции',
        badge: 'Рекомендуется',
        badgeColor: 'amber',
        icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
    },
    {
        value: 'yandexgpt-5-lite/latest',
        label: 'yandexgpt-5-lite/latest',
        description: 'YandexGPT 5 Lite • Быстрый отклик и новое поколение качества',
        badge: 'Новинка',
        badgeColor: 'emerald',
        icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400" />,
    },
    {
        value: 'yandexgpt-lite/latest',
        label: 'yandexgpt-lite/latest',
        description: 'YandexGPT Lite • Экономичная модель предыдущего поколения',
        badge: 'Lite',
        badgeColor: 'gray',
        icon: <Sparkles className="w-3.5 h-3.5 text-yellow-300" />,
    },
    {
        value: '__custom__',
        label: 'Своя модель...',
        description: 'Ввести кастомный идентификатор модели вручную',
        badge: 'Своя',
        badgeColor: 'purple',
    },
];

export default function YandexSettings({ value, hasKey, disabled, onChange }: Props) {
    const [showKey, setShowKey] = useState(false);

    const isRecognizedPreset = (m: string) =>
        m === 'yandexgpt/latest' ||
        m === 'yandexgpt-5-lite/latest' ||
        m === 'yandexgpt-5-lite' ||
        m === 'yandexgpt-lite/latest';

    const [isCustomModel, setIsCustomModel] = useState(() => {
        const current = value.model || 'yandexgpt/latest';
        return !isRecognizedPreset(current);
    });

    const getSelectedValue = () => {
        if (isCustomModel) return '__custom__';
        if (value.model === 'yandexgpt-5-lite' || value.model === 'yandexgpt-5-lite/latest') {
            return 'yandexgpt-5-lite/latest';
        }
        if (value.model === 'yandexgpt-lite/latest') {
            return 'yandexgpt-lite/latest';
        }
        if (value.model === 'yandexgpt/latest') {
            return 'yandexgpt/latest';
        }
        return '__custom__';
    };

    const handleModelSelect = (selectedValue: string) => {
        if (selectedValue === '__custom__') {
            setIsCustomModel(true);
        } else {
            setIsCustomModel(false);
            onChange({ ...value, model: selectedValue });
        }
    };

    return (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.08] to-transparent p-5 space-y-5 shadow-lg shadow-amber-950/20 backdrop-blur-md animate-fade-in">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-amber-500/15">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">Yandex Cloud Integration</h3>
                        <p className="text-xs text-amber-300/80">SpeechKit STT + YandexGPT</p>
                    </div>
                </div>
                <span
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${
                        hasKey
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                >
                    {hasKey ? '✓ Ключ настроен' : 'Требуется ключ'}
                </span>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
                <label
                    htmlFor="yandex-key"
                    className="flex items-center justify-between text-xs font-semibold text-gray-300 uppercase tracking-wider"
                >
                    <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-amber-400" />
                        API-ключ сервисного аккаунта
                    </span>
                    {hasKey && (
                        <span className="text-[11px] font-normal text-gray-400 lowercase">
                            (оставьте пустым для сохранения текущего)
                        </span>
                    )}
                </label>
                <div className="relative">
                    <input
                        id="yandex-key"
                        type={showKey ? 'text' : 'password'}
                        autoComplete="off"
                        value={value.apiKey}
                        disabled={disabled}
                        onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
                        placeholder={hasKey ? '••••••••••••••••••••••••••••••••' : 'AQVN... (API-ключ Yandex Cloud)'}
                        className="w-full glass bg-gray-950/60 border border-amber-500/30 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-gray-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        disabled={disabled}
                        tabIndex={-1}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
                        title={showKey ? 'Скрыть ключ' : 'Показать ключ'}
                    >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-xs text-gray-400">
                    {hasKey
                        ? 'Сохранённый ключ защищён и не отображается в открытом виде.'
                        : 'Создайте API-ключ для сервисного аккаунта в консоли Yandex Cloud.'}
                </p>
            </div>

            {/* Folder ID */}
            <div className="space-y-1.5">
                <label
                    htmlFor="yandex-folder"
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 uppercase tracking-wider"
                >
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    Идентификатор каталога (Folder ID)
                </label>
                <input
                    id="yandex-folder"
                    value={value.folderId}
                    disabled={disabled}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => onChange({ ...value, folderId: e.target.value })}
                    placeholder="b1g..."
                    className="w-full glass bg-gray-950/60 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all font-mono"
                />
                <p className="text-xs text-gray-400">
                    ID каталога из адресной строки или настроек консоли Yandex Cloud.
                </p>
            </div>

            {/* Model Selection via CustomSelect */}
            <div className="space-y-2">
                <CustomSelect
                    label="Модель YandexGPT для постобработки"
                    value={getSelectedValue()}
                    onChange={handleModelSelect}
                    options={YANDEX_MODEL_OPTIONS}
                    variant="amber"
                    helperText="Используется в режимах «Корректор» и «Перевод». Обычный режим работает напрямую через SpeechKit."
                />

                {isCustomModel && (
                    <div className="pt-2 animate-scale-in">
                        <input
                            id="yandex-model-custom"
                            type="text"
                            value={value.model}
                            disabled={disabled}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(e) => onChange({ ...value, model: e.target.value })}
                            placeholder="yandexgpt-5-lite/latest или URI модели..."
                            className="w-full glass bg-gray-950/60 border border-amber-500/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all font-mono"
                        />
                    </div>
                )}
            </div>

            {/* Informational Callout */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-medium text-amber-300">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Требуемые права сервисного аккаунта:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="font-mono text-[11px] bg-black/30 px-2 py-0.5 rounded border border-amber-500/20 text-amber-200">
                        ai.speechkit-stt.user
                    </span>
                    <span className="font-mono text-[11px] bg-black/30 px-2 py-0.5 rounded border border-amber-500/20 text-amber-200">
                        ai.languageModels.user
                    </span>
                </div>
            </div>
        </div>
    );
}
