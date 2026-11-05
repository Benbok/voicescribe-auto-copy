import type { RecordingShortcutState, RecorderStatus } from '../types';

export const DEFAULT_RECORDING_SHORTCUT = 'Super+Alt';

export function displayShortcut(value: string): string {
    return value.replace(/Super/g, 'Win').replace(/Control/g, 'Ctrl').replace(/Space/g, 'Пробел');
}

export async function getRecordingShortcut(): Promise<RecordingShortcutState> {
    if (!window.electronAPI?.getRecordingShortcut) {
        return { accelerator: DEFAULT_RECORDING_SHORTCUT, registered: false, error: 'Глобальные сочетания доступны в приложении Electron.' };
    }
    return window.electronAPI.getRecordingShortcut();
}

export async function setRecordingShortcut(value: string): Promise<RecordingShortcutState> {
    if (!window.electronAPI?.setRecordingShortcut) throw new Error('Запустите приложение Electron для настройки глобальных сочетаний.');
    return window.electronAPI.setRecordingShortcut(value);
}

export function subscribeRecordingToggle(callback: () => void): () => void {
    return window.electronAPI?.onRecordingToggle?.(callback) || (() => {});
}

export function subscribeShortcutState(callback: (state: RecordingShortcutState) => void): () => void {
    return window.electronAPI?.onShortcutStateChange?.(callback) || (() => {});
}

export function reportRecordingStatus(status: RecorderStatus | 'ERROR'): void {
    window.electronAPI?.setRecordingStatus?.(status);
}

export async function writeDesktopClipboard(text: string): Promise<boolean> {
    if (!window.electronAPI?.writeClipboardText) return false;
    await window.electronAPI.writeClipboardText(text);
    return true;
}

export async function pasteTranscript(text: string): Promise<{ copied: boolean; pasted: boolean; reason?: string }> {
    if (!window.electronAPI?.copyAndPasteText) return { copied: false, pasted: false, reason: 'unsupported' };
    return window.electronAPI.copyAndPasteText(text);
}

export function shortcutFromEvent(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null {
    const modifiers = [event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Super'].filter(Boolean);
    if (/^(Control|Alt|Shift|Meta)/.test(event.code)) {
        return event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey ? DEFAULT_RECORDING_SHORTCUT : null;
    }
    const key = event.code.replace(/^Key|^Digit/, '').replace(/^Arrow/, '');
    if (!modifiers.length || !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right)$/.test(key)) return null;
    return [...modifiers, key].join('+');
}

export function createSpaceReleaseHandlers(onToggle: () => void, isBlocked: (event: KeyboardEvent) => boolean) {
    let armed = false;
    const plain = (event: KeyboardEvent) => !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
    return {
        keydown(event: KeyboardEvent) {
            if (event.code !== 'Space' || !plain(event) || isBlocked(event)) { armed = false; return; }
            event.preventDefault();
            if (!event.repeat) armed = true;
        },
        keyup(event: KeyboardEvent) {
            if (event.code !== 'Space') { armed = false; return; }
            const toggle = armed && plain(event) && !isBlocked(event);
            armed = false;
            if (toggle) { event.preventDefault(); onToggle(); }
        },
        blur() { armed = false; },
    };
}
