using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static int Main(string[] args)
    {
        var tool = Path.GetFileNameWithoutExtension(Environment.GetCommandLineArgs()[0]);
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var executable = Path.Combine(home, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "poppler", "Library", "bin", tool + ".exe");
        var arguments = "";
        foreach (var argument in args)
        {
            arguments += " \"" + argument.Replace("\"", "\\\"") + "\"";
        }
        var start = new ProcessStartInfo(executable, arguments);
        start.UseShellExecute = false;
        using (var process = Process.Start(start))
        {
            if (process == null) return 1;
            process.WaitForExit();
            return process.ExitCode;
        }
    }
}
