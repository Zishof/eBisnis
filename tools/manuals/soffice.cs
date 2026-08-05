using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static int Main(string[] args)
    {
        var directory = AppContext.BaseDirectory;
        var script = Path.Combine(directory, "soffice-word.ps1");
        var start = new ProcessStartInfo();
        start.FileName = "powershell.exe";
        start.UseShellExecute = false;
        var arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script.Replace("\"", "\\\"") + "\"";
        foreach (var argument in args)
        {
            arguments += " \"" + argument.Replace("\"", "\\\"") + "\"";
        }
        start.Arguments = arguments;
        using (var process = Process.Start(start))
        {
            if (process == null) return 1;
            process.WaitForExit();
            return process.ExitCode;
        }
    }
}
