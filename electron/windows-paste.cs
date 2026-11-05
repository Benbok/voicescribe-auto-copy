using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Security.Cryptography;
using System.Text;

public static class VoiceScribePaste {
    [StructLayout(LayoutKind.Sequential)]
    public struct KeyboardInput { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)]
    public struct MouseInput { public int x, y; public uint data, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Explicit)]
    public struct InputData {
        [FieldOffset(0)] public KeyboardInput keyboard;
        [FieldOffset(0)] public MouseInput mouse;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct Input { public uint type; public InputData data; }
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, Input[] inputs, int size);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern bool OpenClipboard(IntPtr owner);
    [DllImport("user32.dll")] private static extern bool CloseClipboard();
    [DllImport("user32.dll")] private static extern IntPtr GetClipboardData(uint format);
    [DllImport("user32.dll")] private static extern uint GetClipboardSequenceNumber();
    [DllImport("kernel32.dll")] private static extern IntPtr GlobalLock(IntPtr memory);
    [DllImport("kernel32.dll")] private static extern bool GlobalUnlock(IntPtr memory);
    public static string TextHash(string text) {
        using (SHA256 hash = SHA256.Create()) {
            return BitConverter.ToString(hash.ComputeHash(Encoding.Unicode.GetBytes(text.Replace("\r\n", "\n")))).Replace("-", "").ToLowerInvariant();
        }
    }
    private static bool ClipboardMatches(string expectedHash, out uint sequence) {
        sequence = 0;
        if (!OpenClipboard(IntPtr.Zero)) return false;
        try {
            IntPtr handle = GetClipboardData(13); // CF_UNICODETEXT
            if (handle == IntPtr.Zero) return false;
            IntPtr data = GlobalLock(handle);
            if (data == IntPtr.Zero) return false;
            try {
                string text = Marshal.PtrToStringUni(data);
                sequence = GetClipboardSequenceNumber();
                return text != null && TextHash(text) == expectedHash;
            } finally { GlobalUnlock(handle); }
        } finally { CloseClipboard(); }
    }
    public static int InputSize() { return Marshal.SizeOf(typeof(Input)); }
    private static Input Key(ushort key, bool up) {
        Input input = new Input();
        input.type = 1;
        input.data.keyboard.vk = key;
        input.data.keyboard.flags = up ? 2u : 0u;
        return input;
    }
    public static Input[] BuildInputs() {
        return new Input[] { Key(0x11, false), Key(0x56, false), Key(0x56, true), Key(0x11, true) };
    }
    private static bool KeysHeld() {
        foreach (int key in new int[] { 0x10, 0x11, 0x12, 0x5B, 0x5C, 0x56 }) {
            if (GetAsyncKeyState(key) < 0) return true;
        }
        return false;
    }
    public static string Paste(int excludedPid, string expectedHash) {
        IntPtr target = GetForegroundWindow();
        if (target == IntPtr.Zero) return "no-target";
        uint pid;
        GetWindowThreadProcessId(target, out pid);
        if (pid == (uint)excludedPid) return "own-window";
        // Never release the user's held modifiers or change foreground focus.
        int attempts = 0;
        while (KeysHeld() && attempts++ < 75) Thread.Sleep(20);
        if (KeysHeld()) return "keys-held";
        uint sequence;
        if (!ClipboardMatches(expectedHash, out sequence)) return "clipboard-changed";
        if (GetForegroundWindow() != target) return "focus-changed";
        Input[] inputs = BuildInputs();
        if (GetClipboardSequenceNumber() != sequence) return "clipboard-changed";
        if (SendInput((uint)inputs.Length, inputs, InputSize()) == inputs.Length) return "pasted";
        // Best-effort release if Windows accepted only part of the sequence.
        SendInput(2, new Input[] { Key(0x56, true), Key(0x11, true) }, InputSize());
        return "blocked";
    }
}
