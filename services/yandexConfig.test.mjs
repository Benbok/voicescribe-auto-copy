import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['services/yandexConfig.ts'], bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' } });
const service = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

function withConfig(run) {
    const previousStorage = globalThis.localStorage;
    const previousWindow = globalThis.window;
    const stored = new Map();
    const env = {};
    globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
    globalThis.window = { electronEnv: { get: key => env[key] } };
    try { run(stored, env); } finally {
        if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
        if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    }
}

test('Electron settings are read at call time after env arrives', () => withConfig((stored, env) => {
    assert.equal(service.getYandexConfig().apiKey, '');
    env.YANDEX_API_KEY = 'env-key';
    env.YANDEX_FOLDER_ID = 'folder';
    assert.equal(service.getYandexConfig().apiKey, 'env-key');
    assert.equal(service.getYandexConfig().model, 'yandexgpt/latest');
    stored.set('YANDEX_API_KEY', 'saved-key');
    assert.equal(service.getYandexConfig().apiKey, 'saved-key');
}));

test('valid configuration is trimmed and persisted', () => withConfig(() => {
    service.saveYandexConfig({ apiKey: ' key ', folderId: ' folder ', model: '' });
    assert.deepEqual(service.getYandexConfig(), { apiKey: 'key', folderId: 'folder', model: 'yandexgpt/latest' });
}));

test('invalid drafts never overwrite working configuration', () => withConfig(() => {
    const working = { apiKey: 'working', folderId: 'folder', model: 'yandexgpt/latest' };
    service.saveYandexConfig(working);
    for (const draft of [{ ...working, apiKey: 'ключ' }, { ...working, folderId: '' }, { ...working, model: 'bad model' }]) {
        assert.throws(() => service.saveYandexConfig(draft));
        assert.deepEqual(service.getYandexConfig(), working);
    }
}));
