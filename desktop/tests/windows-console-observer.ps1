param([int]$DurationMs = 75000, [string]$OutputFile, [string]$ReadyFile)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public class BridgeConsoleObserver {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct ProcessEntry {
    public uint size, usage, pid; public IntPtr heap; public uint module, threads, parent; public int priority; public uint flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string name;
  }
  [DllImport("kernel32.dll")] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern bool Process32First(IntPtr snapshot, ref ProcessEntry entry);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern bool Process32Next(IntPtr snapshot, ref ProcessEntry entry);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static string Ancestors(uint pid) {
    var parents = new Dictionary<uint, ProcessEntry>(); var handle = CreateToolhelp32Snapshot(2, 0);
    try {
      var entry = new ProcessEntry(); entry.size = (uint)Marshal.SizeOf(typeof(ProcessEntry));
      if (Process32First(handle, ref entry)) do { parents[entry.pid] = entry; } while (Process32Next(handle, ref entry));
    } finally { CloseHandle(handle); }
    var rows = new List<string>(); var seen = new HashSet<uint>();
    while (pid != 0 && seen.Add(pid) && rows.Count < 12) {
      ProcessEntry entry; if (!parents.TryGetValue(pid, out entry)) break;
      rows.Add("{\"pid\":" + pid + ",\"name\":\"" + entry.name.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\",\"parentPid\":" + entry.parent + "}"); pid = entry.parent;
    }
    return "[" + string.Join(",", rows) + "]";
  }
  delegate bool EnumCallback(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumCallback callback, IntPtr parameter);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  public static string Run(int duration, string readyFile) {
    var events = new List<string>();
    var visible = new HashSet<IntPtr>();
    var timer = Stopwatch.StartNew();
    bool baseline = true;
    do {
      var current = new HashSet<IntPtr>();
      EnumWindows((window, parameter) => {
        if (!IsWindowVisible(window)) return true;
        var name = new StringBuilder(256); GetClassName(window, name, name.Capacity);
        if (name.ToString() != "ConsoleWindowClass" && name.ToString() != "CASCADIA_HOSTING_WINDOW_CLASS") return true;
        current.Add(window);
        if (!baseline && !visible.Contains(window)) {
          uint pid; GetWindowThreadProcessId(window, out pid);
          events.Add("{\"elapsedMs\":" + timer.ElapsedMilliseconds + ",\"pid\":" + pid + ",\"class\":\"" + name + "\",\"ancestors\":" + Ancestors(pid) + "}");
        }
        return true;
      }, IntPtr.Zero);
      visible = current;
      if (baseline) { baseline = false; System.IO.File.WriteAllText(readyFile, "ready"); }
      Thread.Sleep(20);
    } while (timer.ElapsedMilliseconds < duration);
    return "{\"durationMs\":" + timer.ElapsedMilliseconds + ",\"sampleIntervalMs\":20,\"events\":[" + string.Join(",", events) + "]}";
  }
}
'@
[BridgeConsoleObserver]::Run($DurationMs, $ReadyFile) | Set-Content -Encoding UTF8 -LiteralPath $OutputFile
