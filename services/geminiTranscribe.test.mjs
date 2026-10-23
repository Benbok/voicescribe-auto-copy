import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcribeWithInteractions, usesTranscriptionApi } from './geminiTranscribe.ts';

const options = { apiKey: 'private-key', model: 'gemini-3.5-transcribe', mimeType: 'audio/webm;codecs=opus', base64Audio: 'YXVkaW8=' };
const run = (data) => transcribeWithInteractions(options, async () => new Response(JSON.stringify(data)));

test('routes only the dedicated transcription model', () => {
    assert.equal(usesTranscriptionApi('gemini-3.5-transcribe'), true);
    assert.equal(usesTranscriptionApi('gemini-2.5-flash'), false);
    assert.equal(usesTranscriptionApi('gemini-3.5-transcribe-live'), false);
});

test('sends inline audio through Interactions without a generation prompt', async () => {
    const text = await transcribeWithInteractions(options, async (url, init) => {
        assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
        assert.equal(init.method, 'POST');
        assert.equal(init.headers['x-goog-api-key'], options.apiKey);
        const body = JSON.parse(init.body);
        assert.equal(body.model, options.model);
        assert.equal(body.store, false);
        assert.deepEqual(body.input, [{ type: 'audio', data: options.base64Audio, mime_type: 'audio/webm' }]);
        assert.equal(body.generation_config.transcription_config.mode, 'smart');
        return new Response(JSON.stringify({ status: 'completed', steps: [
            { type: 'user_input', content: [{ type: 'text', text: 'DO NOT RETURN' }] },
            { type: 'model_output', content: [{ type: 'thought', text: 'DO NOT RETURN' }, { type: 'text', text: ' Тест. ' }] },
        ] }));
    });
    assert.equal(text, 'Тест.');
});

test('accepts output_text and legacy outputs', async () => {
    assert.equal(await run({ output_text: ' Text. ' }), 'Text.');
    assert.equal(await run({ outputs: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world.' }] }), 'Hello world.');
});

test('rejects empty, incomplete and failed results', async () => {
    for (const result of [{}, { output_text: ' ' }, { status: 'failed', output_text: 'partial' }, { status: 'incomplete', output_text: 'partial' }]) {
        await assert.rejects(run(result), /Gemini/);
    }
});

test('preserves HTTP error codes without exposing server response or credentials', async () => {
    for (const status of [400, 401, 403, 404, 429, 503]) {
        await assert.rejects(transcribeWithInteractions(options, async () => new Response('private-key', { status })), (error) => {
            assert.equal(error.status, status);
            assert.equal(error.message.includes('private-key'), false);
            return true;
        });
    }
});

test('times out a stalled request', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = transcribeWithInteractions(options, async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('abort')), { once: true });
    }));
    const assertion = assert.rejects(pending, /время/i);
    context.mock.timers.tick(120000);
    await assertion;
});
