import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGeminiApiKey } from './geminiKeyValidation.ts';

test('empty keys are rejected without sending a request', async () => {
    let called = false;
    const result = await validateGeminiApiKey('  ', async () => { called = true; });
    assert.equal(result.status, 'error');
    assert.equal(called, false);
});

test('checks the supplied key without putting it in the URL', async () => {
    const result = await validateGeminiApiKey(' test-key ', async (url, options) => {
        assert.equal(url.includes('test-key'), false);
        assert.equal(options.headers['x-goog-api-key'], 'test-key');
        assert.ok(options.signal);
        return new Response(JSON.stringify({ models: [{ name: 'models/example' }] }));
    });
    assert.equal(result.status, 'ok');
});

for (const [status, message] of [[400, /ключ/], [401, /ключ/], [403, /доступ/], [429, /лимит/], [503, /недоступен/]]) {
    test(`reports HTTP ${status} without exposing the response or key`, async () => {
        const result = await validateGeminiApiKey('secret-key', async () => new Response('secret-key', { status }));
        assert.equal(result.status, 'error');
        assert.match(result.message, message);
        assert.equal(result.message.includes('secret-key'), false);
    });
}

test('reports a network error without exposing the key', async () => {
    const result = await validateGeminiApiKey('secret-key', async () => { throw new Error('secret-key'); });
    assert.equal(result.status, 'error');
    assert.match(result.message, /соединение/);
    assert.equal(result.message.includes('secret-key'), false);
});

test('does not report success when no models are available', async () => {
    const result = await validateGeminiApiKey('key', async () => new Response('{}'));
    assert.equal(result.status, 'error');
});

test('aborts a request after the timeout', async (context) => {
    context.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = validateGeminiApiKey('key', async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    context.mock.timers.tick(10000);
    const result = await pending;
    assert.equal(result.status, 'error');
    assert.match(result.message, /истекло/);
});

test('does not accept an invalid API response', async () => {
    const result = await validateGeminiApiKey('key', async () => new Response('not json'));
    assert.equal(result.status, 'error');
});
