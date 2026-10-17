using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

// Owns kernel handles, not PID-based kill sweeps. Built in CI; no compiler is run by the app.
class PtyJobHost {
  [StructLayout(LayoutKind.Sequential)] struct Basic {
    public long ProcessTime, JobTime; public uint Flags; public UIntPtr MinWorkingSet, MaxWorkingSet;
    public uint ActiveProcesses; public UIntPtr Affinity; public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct Extended {
    public Basic Basic; public IO IO; public UIntPtr ProcessMemory, JobMemory, PeakProcess, PeakJob;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, IntPtr info, uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint rights, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static void Watch(int pid) {
    // Open/retain the process handle before starting to accept shell assignments.
    Process parent = Process.GetProcessById(pid);
    IntPtr handle = parent.Handle;
    ThreadPool.QueueUserWorkItem(delegate { try { parent.WaitForExit(); } finally { Environment.Exit(0); } });
  }
  static int Main(string[] args) {
    Dictionary<string, IntPtr> jobs = new Dictionary<string, IntPtr>();
    try {
      Watch(int.Parse(args[0])); Watch(int.Parse(args[1]));
      Console.WriteLine("READY");
      string line;
      while ((line = Console.ReadLine()) != null) {
        string[] parts = line.Split(' ');
        string id = parts.Length > 1 ? parts[1] : "invalid";
        try {
          if (parts[0] == "ADD" && parts.Length == 3 && !jobs.ContainsKey(id)) {
            IntPtr job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) throw new Exception();
            try {
              Extended limits = new Extended(); limits.Basic.Flags = 0x2000; // KILL_ON_JOB_CLOSE; no breakaway.
              int length = Marshal.SizeOf(typeof(Extended)); IntPtr memory = Marshal.AllocHGlobal(length);
              try { Marshal.StructureToPtr(limits, memory, false); if (!SetInformationJobObject(job, 9, memory, (uint)length)) throw new Exception(); }
              finally { Marshal.FreeHGlobal(memory); }
              IntPtr process = OpenProcess(0x0101, false, int.Parse(parts[2])); // SET_QUOTA | TERMINATE
              if (process == IntPtr.Zero) throw new Exception();
              try { if (!AssignProcessToJobObject(job, process)) throw new Exception(); }
              finally { CloseHandle(process); }
              jobs.Add(id, job); job = IntPtr.Zero;
            } finally { if (job != IntPtr.Zero) CloseHandle(job); }
          } else if (parts[0] == "KILL" && parts.Length == 2) {
            IntPtr job; if (jobs.TryGetValue(id, out job)) { CloseHandle(job); jobs.Remove(id); }
          } else throw new Exception();
          Console.WriteLine("OK " + id);
        } catch { Console.WriteLine("ERR " + id); }
      }
      return 0;
    } catch { return 1; }
    finally { foreach (IntPtr job in jobs.Values) CloseHandle(job); }
  }
}
