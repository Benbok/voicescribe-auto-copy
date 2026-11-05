const DEFAULT_SHORTCUT = 'Super+Alt';

function normalizeShortcut(value) {
  if (typeof value !== 'string' || value.length > 80) throw new Error('Некорректное сочетание клавиш.');
  const aliases = { Win: 'Super', Meta: 'Super', Ctrl: 'Control', Cmd: 'Command' };
  const parts = value.trim().split('+').map(part => aliases[part] || part);
  if (parts.length === 2 && parts.includes('Super') && parts.includes('Alt')) return DEFAULT_SHORTCUT;
  const key = parts.pop();
  const modifiers = ['Control', 'Alt', 'Shift', 'Super', 'Command', 'CommandOrControl'];
  if (!parts.length || !parts.some(part => part !== 'Shift') || parts.some(part => !modifiers.includes(part)) || new Set(parts).size !== parts.length
    || !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Up|Down|Left|Right)$/.test(key)) {
    throw new Error('Выберите Win+Alt или сочетание с Ctrl, Alt или Win и одной обычной клавишей.');
  }
  return [...modifiers.filter(part => parts.includes(part)), key].join('+');
}

function createShortcutManager({ globalShortcut, startWinAlt, read, write, onToggle, onState = () => {}, platform = process.platform }) {
  let accelerator = platform === 'win32' ? DEFAULT_SHORTCUT : 'Control+Alt+R';
  let release = null;
  let error = '';
  let queue = Promise.resolve();
  let disposed = false;
  const getState = () => ({ accelerator, registered: Boolean(release), error });
  const publish = () => onState(getState());
  const register = async key => {
    if (key === DEFAULT_SHORTCUT && platform !== 'win32') throw new Error('Win+Alt поддерживается только в Windows.');
    if (platform === 'win32') {
      // Reserve ordinary accelerators to detect conflicts, but only the native
      // release detector may toggle recording, never Electron's keydown callback.
      const reserved = key !== DEFAULT_SHORTCUT;
      if (reserved && !globalShortcut.register(key, () => {})) throw new Error('Сочетание занято другой программой. Выберите другое.');
      try {
        const stop = await startWinAlt(onToggle, reason => {
          if (accelerator === key && !disposed) { release = null; error = reason; if (reserved) globalShortcut.unregister(key); publish(); }
        }, key);
        return () => { stop(); if (reserved) globalShortcut.unregister(key); };
      } catch (failure) { if (reserved) globalShortcut.unregister(key); throw failure; }
    }
    if (!globalShortcut.register(key, onToggle)) throw new Error('Сочетание занято другой программой. Выберите другое.');
    return () => globalShortcut.unregister(key);
  };
  const replace = async (value, persist) => {
    if (disposed) throw new Error('Приложение завершает работу.');
    const key = normalizeShortcut(value);
    if (key === accelerator && release) return getState();
    const candidate = await register(key);
    try {
      if (disposed) throw new Error('Приложение завершает работу.');
      if (persist) write(key);
    } catch (failure) { candidate(); throw failure; }
    const old = release;
    release = candidate;
    accelerator = key;
    error = '';
    if (old) old();
    publish();
    return getState();
  };
  return {
    getState,
    init: () => {
      const result = queue.then(async () => {
        try { await replace(read() || accelerator, false); }
        catch (failure) { error = failure.message; publish(); }
        return getState();
      });
      queue = result.catch(() => {});
      return result;
    },
    set: value => {
      const result = queue.then(() => replace(value, true));
      queue = result.catch(() => {});
      return result;
    },
    dispose: () => { disposed = true; if (release) release(); release = null; },
  };
}

module.exports = { DEFAULT_SHORTCUT, normalizeShortcut, createShortcutManager };
