using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

// Tracks only held keys in memory; no key history or key text is recorded.
public class ReleaseChord {
    private readonly HashSet<int> down = new HashSet<int>();
    private readonly HashSet<int> target = new HashSet<int>();
    private bool armed;
    private bool blocked;
    private static int Canonical(int key) {
        if (key == 0x5C) return 0x5B;
        if (key == 0xA4 || key == 0xA5) return 0x12;
        if (key == 0xA0 || key == 0xA1) return 0x10;
        if (key == 0xA2 || key == 0xA3) return 0x11;
        return key;
    }
    public ReleaseChord(string accelerator) {
        foreach (string token in accelerator.Split('+')) {
            int key;
            switch (token) {
                case "Super": key = 0x5B; break;
                case "Control": case "CommandOrControl": case "Command": key = 0x11; break;
                case "Shift": key = 0x10; break;
                case "Alt": key = 0x12; break;
                case "Space": key = 0x20; break;
                case "Enter": key = 0x0D; break;
                case "Escape": key = 0x1B; break;
                case "Tab": key = 0x09; break;
                case "Backspace": key = 0x08; break;
                case "Delete": key = 0x2E; break;
                case "Insert": key = 0x2D; break;
                case "Home": key = 0x24; break;
                case "End": key = 0x23; break;
                case "PageUp": key = 0x21; break;
                case "PageDown": key = 0x22; break;
                case "Up": key = 0x26; break;
                case "Down": key = 0x28; break;
                case "Left": key = 0x25; break;
                case "Right": key = 0x27; break;
                default:
                    if (token.Length == 1) key = (int)token[0];
                    else if (token.StartsWith("F")) key = 0x6F + Int32.Parse(token.Substring(1));
                    else throw new ArgumentException("Unsupported shortcut");
                    break;
            }
            target.Add(key);
        }
    }
    private bool Complete() {
        HashSet<int> held = new HashSet<int>();
        foreach (int key in down) held.Add(Canonical(key));
        return target.SetEquals(held);
    }
    public bool Feed(int key, bool pressed) {
        bool trigger = false;
        if (pressed) {
            down.Add(key);
            if (!target.Contains(Canonical(key))) blocked = true;
            if (Complete() && !blocked) armed = true;
        } else {
            down.Remove(key);
            if (down.Count == 0) { trigger = armed && !blocked; blocked = false; armed = false; }
        }
        return trigger;
    }
}

public sealed class WinAltChord : ReleaseChord { public WinAltChord() : base("Super+Alt") {} }

public static class VoiceScribeHotkey {
    private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    private static readonly HookProc callback = HandleKey;
    private static ReleaseChord chord;
    private static IntPtr hook;
    [StructLayout(LayoutKind.Sequential)] private struct KeyData { public uint vk, scan, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] private struct Point { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] private struct Message { public IntPtr hwnd; public uint message; public UIntPtr wparam; public IntPtr lparam; public uint time; public Point point; public uint priv; }
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr handle);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr handle, int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll")] private static extern int GetMessage(out Message message, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread, uint message, UIntPtr wparam, IntPtr lparam);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto)] private static extern IntPtr GetModuleHandle(string name);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    private static IntPtr HandleKey(int code, IntPtr message, IntPtr data) {
        if (code >= 0) {
            KeyData key = (KeyData)Marshal.PtrToStructure(data, typeof(KeyData));
            int kind = message.ToInt32();
            // Ignore injected events and emit one fixed message, never key data.
            if ((key.flags & 0x10) == 0 && (kind == 0x100 || kind == 0x104 || kind == 0x101 || kind == 0x105)) {
                if (chord.Feed((int)key.vk, kind == 0x100 || kind == 0x104)) Console.WriteLine("toggle");
            }
        }
        return CallNextHookEx(hook, code, message, data);
    }
    public static void Run(int parentId, string accelerator) {
        chord = new ReleaseChord(accelerator);
        uint thread = GetCurrentThreadId();
        hook = SetWindowsHookEx(13, callback, GetModuleHandle(null), 0);
        if (hook == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        using (Timer timer = new Timer(delegate(object state) {
            try { using (Process parent = Process.GetProcessById(parentId)) { if (!parent.HasExited) return; } } catch { }
            PostThreadMessage(thread, 0x12, UIntPtr.Zero, IntPtr.Zero);
        }, null, 1000, 1000)) {
            try {
                Console.WriteLine("ready");
                Message message;
                while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0) { }
            } finally { UnhookWindowsHookEx(hook); }
        }
    }
}
