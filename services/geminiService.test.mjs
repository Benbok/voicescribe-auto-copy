import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Exercise the real orchestration with local SDK/quota doubles and no credentials.
const bundle = await build({
    entryPoints: ['services/geminiService.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
    define: { 'import.meta.env': '{}', 'process.env.GEMINI_API_KEY': '"test-key"', 'process.env.GEMINI_MODEL': '"gemini-3.5-transcribe"' },
    plugins: [{ name: 'local-service-doubles', setup(builder) {
        builder.onResolve({ filter: /^@google\/genai$|^\.\/quotaService$/ }, (args) => ({ path: args.path, namespace: 'test-double' }));
        builder.onLoad({ filter: /.*/, namespace: 'test-double' }, (args) => ({ contents: args.path === '@google/genai'
            ? 'export class GoogleGenAI { models = { generateContent: async (request) => { globalThis.__transcribeTest.generations.push(request); return { text: "Processed text." }; } }; }'
            : 'export const updateQuotaUsage = (...args) => globalThis.__transcribeTest.quota.push(args);' }));
    } }],
});
let instance = 0;

async function withService(run, responseStatus = 200) {
    const originalFetch = globalThis.fetch;
    const originalReader = globalThis.FileReader;
    const state = { generations: [], quota: [], requests: [] };
    globalThis.__transcribeTest = state;
    globalThis.FileReader = class {
        readAsDataURL() { this.result = 'data:audio/webm;base64,YXVkaW8='; this.onloadend(); }
    };
    globalThis.fetch = async (url, init) => {
        state.requests.push({ url, init });
        if (url.endsWith('/interactions')) return new Response(JSON.stringify({ status: 'completed', steps: [
            { type: 'model_output', content: [{ type: 'text', text: 'Исходный текст.' }] },
        ] }), { status: responseStatus });
        return new Response(JSON.stringify({ models: [] }));
    };
    try {
        const service = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#${instance++}`);
        await run(service, state);
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.FileReader = originalReader;
        delete globalThis.__transcribeTest;
    }
}

test('dedicated model returns transcript without generateContent or model discovery', async () => withService(async (service, state) => {
    const result = await service.transcribeAudio(new Blob(['audio'], { type: 'audio/webm' }));
    assert.equal(result.text, 'Исходный текст.');
    assert.equal(result.provider, 'Gemini (gemini-3.5-transcribe)');
    assert.equal(state.generations.length, 0);
    assert.equal(state.requests.length, 1);
    assert.equal(state.quota.length, 1);
}));

for (const mode of ['translator', 'corrector']) {
    test(`${mode} processes the transcript as text through Flash`, async () => withService(async (service, state) => {
        const result = await service.transcribeAudio(new Blob(['audio']), mode);
        assert.equal(result.text, 'Processed text.');
        assert.equal(state.generations.length, 1);
        assert.equal(state.generations[0].model, 'gemini-2.5-flash');
        assert.equal(state.generations[0].contents.parts[1].text, 'Исходный текст.');
        assert.match(state.generations[0].contents.parts[0].text, mode === 'translator' ? /английский/ : /деловом/);
        assert.equal(state.requests.length, 1);
    }));
}

test('access denial does not silently fall back to a different model', async () => withService(async (service, state) => {
    await assert.rejects(service.transcribeAudio(new Blob(['audio'])), /403/);
    assert.equal(state.generations.length, 0);
    assert.equal(state.requests.length, 1);
    assert.equal(state.quota.length, 0);
}, 403));

test('ordinary Flash transcription retains generateContent', async () => withService(async (service, state) => {
    service.setGeminiModel('gemini-2.5-flash');
    const result = await service.transcribeAudio(new Blob(['audio']));
    assert.equal(result.text, 'Processed text.');
    assert.equal(state.generations[0].contents.parts[0].inlineData.data, 'YXVkaW8=');
    assert.equal(state.requests.some(({ url }) => url.endsWith('/interactions')), false);
}));

test('live-only model produces an actionable error without a request', async () => withService(async (service, state) => {
    service.setGeminiModel('gemini-3.5-transcribe-live');
    await assert.rejects(service.transcribeAudio(new Blob(['audio'])), /потокового/);
    assert.equal(state.requests.length, 0);
    assert.equal(state.generations.length, 0);
}));

test('dedicated model health check never uses generateContent', async () => withService(async (service, state) => {
    const health = await service.checkGeminiHealth();
    assert.equal(health.status, 'ok');
    assert.equal(state.generations.length, 0);
    assert.equal(state.requests.length, 1);
    assert.match(state.requests[0].url, /\/models\/gemini-3\.5-transcribe$/);
}));
