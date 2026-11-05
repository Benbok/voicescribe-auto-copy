export interface YandexConfig {
    apiKey: string;
    folderId: string;
    model: string;
}

const DEFAULT_MODEL = 'yandexgpt/latest';

function readSetting(name: string): string {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(name) : '';
    const electron = typeof window !== 'undefined' ? window.electronEnv as any : undefined;
    const env = (import.meta as any).env || {};
    return (stored ?? electron?.get?.(name) ?? electron?.[name] ?? env[`VITE_${name}`] ?? '').trim();
}

export function getYandexConfig(): YandexConfig {
    return {
        apiKey: readSetting('YANDEX_API_KEY'),
        folderId: readSetting('YANDEX_FOLDER_ID'),
        model: readSetting('YANDEX_GPT_MODEL') || DEFAULT_MODEL,
    };
}

export function validateYandexConfig(config: YandexConfig): void {
    if (!config.apiKey || !/^[\x21-\x7e]+$/.test(config.apiKey)) {
        throw new Error('Укажите API-ключ Yandex Cloud в настройках. Ключ должен содержать только ASCII-символы без пробелов.');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(config.folderId)) {
        throw new Error('Укажите корректный ID каталога Yandex Cloud в настройках.');
    }
    if (!/^[a-zA-Z0-9._/-]+$/.test(config.model)) {
        throw new Error('Укажите модель YandexGPT, например yandexgpt/latest.');
    }
}

export function saveYandexConfig(config: YandexConfig): void {
    const clean = { apiKey: config.apiKey.trim(), folderId: config.folderId.trim(), model: config.model.trim() || DEFAULT_MODEL };
    validateYandexConfig(clean);
    localStorage.setItem('YANDEX_API_KEY', clean.apiKey);
    localStorage.setItem('YANDEX_FOLDER_ID', clean.folderId);
    localStorage.setItem('YANDEX_GPT_MODEL', clean.model);
}
