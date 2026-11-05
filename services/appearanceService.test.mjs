import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
    entryPoints: ['services/appearanceService.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
});

const service = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('default appearance configuration has expected fallback values', () => {
    assert.deepEqual(service.DEFAULT_APPEARANCE_CONFIG, {
        theme: 'dark',
        visualizer: 'waves',
        fontSize: 'md',
        autoCopy: true,
        soundFx: false,
    });
});

test('reading and updating appearance config persists to localStorage and dispatches event', () => {
    const store = new Map();
    const listeners = new Map();
    const docAttrs = new Map();

    globalThis.localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };

    globalThis.document = {
        documentElement: {
            setAttribute: (k, v) => docAttrs.set(`doc:${k}`, v),
        },
        body: {
            setAttribute: (k, v) => docAttrs.set(`body:${k}`, v),
        },
    };

    globalThis.window = {
        addEventListener: (name, cb) => {
            if (!listeners.has(name)) listeners.set(name, []);
            listeners.get(name).push(cb);
        },
        removeEventListener: (name, cb) => {
            const list = listeners.get(name) || [];
            listeners.set(name, list.filter(fn => fn !== cb));
        },
        dispatchEvent: (evt) => {
            const list = listeners.get(evt.type) || [];
            list.forEach(fn => fn(evt));
            return true;
        },
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
    };

    try {
        // Initial defaults
        const initial = service.getAppearanceConfig();
        assert.equal(initial.theme, 'dark');
        assert.equal(initial.visualizer, 'waves');
        assert.equal(initial.fontSize, 'md');
        assert.equal(initial.autoCopy, true);
        assert.equal(initial.soundFx, false);

        // Subscribe to updates
        let receivedUpdate = null;
        const unsubscribe = service.subscribeAppearanceUpdates((updated) => {
            receivedUpdate = updated;
        });

        // Update settings
        const updated = service.updateAppearanceConfig({
            theme: 'cyberpunk',
            visualizer: 'bars',
            fontSize: 'lg',
            autoCopy: false,
            soundFx: true,
        });

        assert.equal(updated.theme, 'cyberpunk');
        assert.equal(updated.visualizer, 'bars');
        assert.equal(updated.fontSize, 'lg');
        assert.equal(updated.autoCopy, false);
        assert.equal(updated.soundFx, true);

        // Check storage
        assert.equal(store.get('voicescribe_theme'), 'cyberpunk');
        assert.equal(store.get('voicescribe_visualizer'), 'bars');
        assert.equal(store.get('voicescribe_font_size'), 'lg');
        assert.equal(store.get('voicescribe_auto_copy'), 'false');
        assert.equal(store.get('voicescribe_sound_fx'), 'true');

        // Check DOM attributes
        assert.equal(docAttrs.get('doc:data-theme-preset'), 'cyberpunk');
        assert.equal(docAttrs.get('doc:data-font-size'), 'lg');
        assert.equal(docAttrs.get('body:data-theme-preset'), 'cyberpunk');

        // Check subscription
        assert.notEqual(receivedUpdate, null);
        assert.equal(receivedUpdate.theme, 'cyberpunk');

        unsubscribe();
    } finally {
        delete globalThis.localStorage;
        delete globalThis.document;
        delete globalThis.window;
    }
});

