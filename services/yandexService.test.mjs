import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['services/yandexService.ts'], bundle: true, write: false, format: 'esm', platform: 'node', define: { 'import.meta.env': '{}' } });
const service = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const config = { apiKey: 'test-key', folderId: 'test-folder', model: 'yandexgpt/latest' };
const alt = text => ({ alternatives: [{ text }] });
const events = [
    { result: { final: alt('привет мир'), audioCursors: { finalIndex: '0' } } },
    { result: { finalRefinement: { finalIndex: '0', normalizedText: alt('Привет, мир!') } } },
    { result: { final: alt('Вторая фраза.'), audioCursors: { finalIndex: '1' } } },
];

test('WAV contains signed 16 bit mono PCM and valid header', () => {
    const wav = service.encodeWav(new Float32Array([-1, 0, 1]), 16000);
    const data = new DataView(wav);
    assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF');
    assert.equal(data.getUint32(24, true), 16000);
    assert.equal(data.getUint16(22, true), 1);
    assert.equal(data.getUint32(40, true), 6);
    assert.equal(data.getInt16(44, true), -32768);
    assert.equal(data.getInt16(48, true), 32767);
});

test('normalized streamed segments replace raw finals without duplication', () => {
    assert.equal(service.parseRecognition(events.map(e => JSON.stringify(e)).join('\n')), 'Привет, мир! Вторая фраза.');
    assert.equal(service.parseRecognition(JSON.stringify(events)), 'Привет, мир! Вторая фраза.');
});

test('empty recognition fails clearly', () => {
    assert.throws(() => service.parseRecognition('{}'), /речь|текст/);
});

function api(responses) {
    const calls = [];
    return { calls, request: async (url, init) => {
        calls.push({ url, ...init });
        const value = responses.shift();
        assert.notEqual(value, undefined, 'unexpected API call');
        return typeof value === 'string' ? value : JSON.stringify(value);
    } };
}

test('general mode returns normalized Russian sentences without requesting GPT', async () => {
    const mock = api([{ id: 'op-1', done: false }, { done: true }, events]);
    const result = await service.recognizeYandex('d2F2', 'general', config, mock.request, async () => {});
    assert.equal(result.text, 'Привет, мир! Вторая фраза.');
    assert.equal(result.provider, 'Yandex SpeechKit');
    assert.equal(mock.calls.length, 3);
    assert.match(mock.calls[1].url, /operations\/op-1$/);
    const body = JSON.parse(mock.calls[0].body);
    assert.equal(body.content, 'd2F2');
    assert.equal(body.recognitionModel.audioFormat.containerAudio.containerAudioType, 'WAV');
    assert.equal(mock.calls[0].headers.Authorization, 'Api-Key test-key');
    assert.deepEqual(body.recognitionModel.languageRestriction, { restrictionType: 'WHITELIST', languageCode: ['ru-RU'] });
    assert.deepEqual(body.recognitionModel.textNormalization, { textNormalization: 'TEXT_NORMALIZATION_ENABLED', literatureText: true });
});

for (const mode of ['corrector', 'translator']) {
    test(`${mode} invokes YandexGPT after recognition`, async () => {
        const mock = api([{ id: 'op-1', done: true }, events, { result: { alternatives: [{ status: 'ALTERNATIVE_STATUS_FINAL', message: { text: 'Processed.' } }] } }]);
        const result = await service.recognizeYandex('d2F2', mode, config, mock.request);
        assert.equal(result.text, 'Processed.');
        assert.match(result.provider, /YandexGPT/);
        const body = JSON.parse(mock.calls[2].body);
        assert.equal(body.modelUri, 'gpt://test-folder/yandexgpt/latest');
        assert.equal(body.messages[1].text, 'Привет, мир! Вторая фраза.');
        assert.match(body.messages[0].text, mode === 'translator' ? /английский/ : /деловом/);
        const recognition = JSON.parse(mock.calls[0].body).recognitionModel;
        assert.deepEqual(recognition.languageRestriction.languageCode, ['ru-RU']);
        assert.equal(recognition.textNormalization.literatureText, true);
    });
}

test('missing credentials fail before network access', async () => {
    const mock = api([]);
    await assert.rejects(service.recognizeYandex('data', 'general', { ...config, apiKey: '' }, mock.request), /API/);
    await assert.rejects(service.recognizeYandex('data', 'general', { ...config, folderId: '' }, mock.request), /каталог/);
    assert.equal(mock.calls.length, 0);
});

test('failed operation surfaces error and does not request GPT', async () => {
    const mock = api([{ id: 'op-1', done: true, error: { code: 7, message: 'Permission denied' } }]);
    await assert.rejects(service.recognizeYandex('data', 'corrector', config, mock.request), /Permission denied/);
    assert.equal(mock.calls.length, 1);
});

test('truncated GPT output is not accepted as a complete transcription', async () => {
    const mock = api([{ id: 'op-1', done: true }, events, { result: { alternatives: [{ status: 'ALTERNATIVE_STATUS_TRUNCATED_FINAL', message: { text: 'Partial' } }] } }]);
    await assert.rejects(service.recognizeYandex('data', 'translator', config, mock.request), /обрезан/);
});

test('polling is bounded', async () => {
    let calls = 0;
    await assert.rejects(service.recognizeYandex('data', 'general', config, async () => {
        calls++;
        return JSON.stringify({ id: 'op-1', done: false });
    }, async () => {}), /время ожидания/);
    assert.ok(calls <= 601);
});

test('long recognition is allowed to complete beyond the first two minutes', async () => {
    let polls = 0;
    const result = await service.recognizeYandex('data', 'general', config, async url => {
        if (url.includes('recognizeFileAsync')) return JSON.stringify({ id: 'long-op', done: false });
        if (url.includes('/operations/')) return JSON.stringify({ done: ++polls >= 180 });
        assert.ok(url.includes('/getRecognition'), 'general mode must not request GPT');
        return JSON.stringify(events);
    }, async () => {});
    assert.equal(polls, 180);
    assert.equal(result.text, 'Привет, мир! Вторая фраза.');
});

for (const status of [401, 403, 429, 503]) {
    test(`HTTP ${status} surfaces a safe error without echoing response bodies`, async () => {
        const original = globalThis.fetch;
        globalThis.fetch = async () => new Response('secret-key audio-data', { status });
        try {
            await assert.rejects(service.yandexRequest('https://example.test', { method: 'GET', headers: {} }), error => {
                assert.match(error.message, new RegExp(String(status)));
                assert.equal(error.message.includes('secret-key'), false);
                return true;
            });
        } finally { globalThis.fetch = original; }
    });
}

test('Electron requests use the CORS-free IPC transport with timeout', async () => {
    const original = globalThis.window;
    globalThis.window = { electronAPI: { fetchApi: async (url, options) => {
        assert.equal(options.timeoutMs, 120000);
        assert.equal(options.body, 'body');
        return { ok: true, status: 200, text: 'response' };
    } } };
    try {
        assert.equal(await service.yandexRequest('https://example.test', { method: 'POST', headers: {}, body: 'body' }), 'response');
    } finally { if (original === undefined) delete globalThis.window; else globalThis.window = original; }
});
