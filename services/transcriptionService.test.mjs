import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
    entryPoints: ['services/transcriptionService.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'provider-doubles', setup(builder) {
        builder.onResolve({ filter: /^\.\/(yandexService|geminiService)$/ }, args => ({ path: args.path, namespace: 'provider-double' }));
        builder.onLoad({ filter: /.*/, namespace: 'provider-double' }, args => ({ contents: args.path.includes('yandex')
            ? 'export const transcribeYandex = async (audio, mode) => ({ text: mode, provider: "yandex" }); export const checkYandexHealth = async () => ({ status: "configured" });'
            : 'export const transcribeAudio = async (audio, mode) => ({ text: mode, provider: "gemini" }); export const checkGeminiHealth = async () => ({ status: "ok" });' }));
    } }],
});
const service = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('Yandex is default including existing installs without a provider setting', async () => {
    const original = globalThis.localStorage;
    const store = new Map();
    globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    try {
        assert.equal(service.getTranscriptionProvider(), 'yandex');
        assert.deepEqual(await service.transcribeAudio(new Blob(['audio']), 'translator'), { text: 'translator', provider: 'yandex' });
        assert.equal((await service.checkProviderHealth()).status, 'configured');
        service.setTranscriptionProvider('gemini');
        assert.equal(service.getTranscriptionProvider(), 'gemini');
        assert.deepEqual(await service.transcribeAudio(new Blob(['audio']), 'corrector'), { text: 'corrector', provider: 'gemini' });
        assert.equal((await service.checkProviderHealth()).status, 'ok');
        service.setTranscriptionProvider('yandex');
        assert.equal(service.getTranscriptionProvider(), 'yandex');
    } finally {
        if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original;
    }
});
