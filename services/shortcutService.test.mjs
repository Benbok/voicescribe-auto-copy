import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['services/shortcutService.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const service = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const event = values => ({ code: 'KeyR', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...values });

test('shortcut capture uses physical key codes independent of Russian keyboard layout', () => {
    assert.equal(service.shortcutFromEvent(event({ ctrlKey: true, shiftKey: true })), 'Control+Shift+R');
    assert.equal(service.shortcutFromEvent(event({ code: 'Space', altKey: true })), 'Alt+Space');
    assert.equal(service.shortcutFromEvent(event({ code: 'AltLeft', altKey: true, metaKey: true })), 'Super+Alt');
    assert.equal(service.shortcutFromEvent(event({ code: 'ControlLeft', ctrlKey: true })), null);
    assert.equal(service.shortcutFromEvent(event({})), null);
    assert.equal(service.displayShortcut('Super+Alt'), 'Win+Alt');
});

test('native clipboard works while hidden and event subscription cleans up', async () => {
    let callback, unsubscribed = false, copied;
    globalThis.window = { electronAPI: {
        onRecordingToggle: cb => { callback = cb; return () => { unsubscribed = true; }; },
        writeClipboardText: async text => { copied = text; },
    } };
    try {
        let toggles = 0;
        const dispose = service.subscribeRecordingToggle(() => toggles++);
        callback();
        assert.equal(toggles, 1);
        dispose();
        assert.equal(unsubscribed, true);
        assert.equal(await service.writeDesktopClipboard('Transcript'), true);
        assert.equal(copied, 'Transcript');
    } finally { delete globalThis.window; }
});

test('browser cannot falsely report global shortcut registration success', async () => {
    globalThis.window = {};
    try {
        assert.equal((await service.getRecordingShortcut()).registered, false);
        await assert.rejects(service.setRecordingShortcut('Super+Alt'), /Electron/);
        assert.equal(await service.writeDesktopClipboard('text'), false);
    } finally { delete globalThis.window; }
});

test('local Space only toggles on a matching plain release and never after a modified chord', () => {
    let toggles = 0;
    const handlers = service.createSpaceReleaseHandlers(() => toggles++, () => false);
    const key = values => ({ ...event({ code: 'Space' }), repeat: false, preventDefault() {}, ...values });
    handlers.keydown(key({}));
    assert.equal(toggles, 0);
    handlers.keydown(key({ repeat: true }));
    handlers.keyup(key({}));
    assert.equal(toggles, 1);
    handlers.keyup(key({}));
    assert.equal(toggles, 1);
    handlers.keydown(key({ ctrlKey: true }));
    handlers.keyup(key({ code: 'ControlLeft' }));
    handlers.keyup(key({}));
    assert.equal(toggles, 1);
    handlers.keydown(key({}));
    handlers.keydown(key({ code: 'AltLeft', altKey: true }));
    handlers.keyup(key({}));
    assert.equal(toggles, 1);
    handlers.keydown(key({}));
    handlers.blur();
    handlers.keyup(key({}));
    assert.equal(toggles, 1);
});

test('automatic delivery uses dedicated copy-and-paste bridge and returns native fallback', async () => {
    const requests = [];
    globalThis.window = { electronAPI: { copyAndPasteText: async text => {
        requests.push(text);
        return { copied: true, pasted: false, reason: 'keys-held' };
    } } };
    try {
        assert.deepEqual(await service.pasteTranscript('Распознанная речь'), { copied: true, pasted: false, reason: 'keys-held' });
        assert.deepEqual(requests, ['Распознанная речь']);
        globalThis.window = {};
        assert.deepEqual(await service.pasteTranscript('text'), { copied: false, pasted: false, reason: 'unsupported' });
    } finally { delete globalThis.window; }
});
