# Launch Chrome on a Windows desktop of its own, so nothing it does can take
# the keyboard away from whatever the human is typing into.
#
# A process started with STARTUPINFO.lpDesktop set is bound to that desktop for
# its lifetime. Its windows are never on the interactive desktop, so they cannot
# raise themselves, grab focus, or move the caret. The browser is still a normal
# headful Chrome: it paints, runs the GPU compositor, and keeps its profile, so
# a signed-in session survives and CDP screenshots come back correct.
#
# It gets a profile directory of its own rather than sharing one. Chrome's
# process singleton cannot be found across desktops, so a second Chrome on the
# same profile does not relay its arguments to the first, it aborts with
# "Failed to create a ProcessSingleton for your profile directory". Keeping the
# directory private means neither the human nor an older-style MCP server can
# collide with it.
#
# The machine's execution policy is AllSigned and this script is unsigned, so
# every invocation needs -ExecutionPolicy Bypass:
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\3hoze\Desktop\website\tools\chrome-desktop.ps1"        start it (idempotent)
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\3hoze\Desktop\website\tools\chrome-desktop.ps1" -Show [-Url <url>]  reopen it as a normal window, to sign in
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\3hoze\Desktop\website\tools\chrome-desktop.ps1" -Hide  close that window, reopen it hidden
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\3hoze\Desktop\website\tools\chrome-desktop.ps1" -Stop  close chrome
#
# -Show and -Hide refuse while pages are open in the browser, since other
# sessions share it; -Force overrides once those are known to be idle, as after
# a sign-in.
#
# -Show never switches the display to the browser's desktop. That desktop has
# no shell, so the human would be left on a black screen that Ctrl+Win+arrows
# cannot leave and Ctrl+Alt+Del then Cancel returns them to. It restarts the
# browser on the human's own desktop instead, same profile and port, so a
# sign-in made there is the hidden browser's sign-in too.

[CmdletBinding()]
param(
  [int]$Port = 9333,
  [string]$Desktop = 'ClaudeChrome',
  [string]$UserDataDir = "$env:USERPROFILE\.chrome-desktop-profile",
  [switch]$Show,
  [string]$Url = '',
  [switch]$Hide,
  [switch]$Stop,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not ('Win.Desktops' -as [type])) {
  Add-Type -Namespace Win -Name Desktops -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct STARTUPINFO {
  public int cb;
  public string lpReserved, lpDesktop, lpTitle;
  public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
  public short wShowWindow, cbReserved2;
  public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
}

[StructLayout(LayoutKind.Sequential)]
public struct PROCESS_INFORMATION {
  public IntPtr hProcess, hThread;
  public int dwProcessId, dwThreadId;
}

// lpszDevice is IntPtr, not string: PowerShell binds $null to a string
// parameter as "", and an empty device name fails with ERROR_INVALID_PARAMETER.
[DllImport("user32.dll", EntryPoint = "CreateDesktopW", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern IntPtr CreateDesktop(string name, IntPtr device, IntPtr devmode, int flags, uint access, IntPtr sa);

[DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern IntPtr OpenDesktop(string name, int flags, bool inherit, uint access);

[DllImport("user32.dll", SetLastError = true)]
public static extern bool CloseDesktop(IntPtr hDesktop);

// lpApplicationName and lpCurrentDirectory are IntPtr for the same reason as
// lpszDevice: an empty application name fails with ERROR_INVALID_NAME.
[DllImport("kernel32.dll", EntryPoint = "CreateProcessW", CharSet = CharSet.Unicode, SetLastError = true)]
public static extern bool CreateProcess(
  IntPtr app, System.Text.StringBuilder cmdLine, IntPtr procAttrs, IntPtr threadAttrs,
  bool inheritHandles, uint flags, IntPtr env, IntPtr cwd,
  ref STARTUPINFO si, out PROCESS_INFORMATION pi);

[DllImport("kernel32.dll", SetLastError = true)]
public static extern bool CloseHandle(IntPtr h);
'@
}

# Every DESKTOP_* right, which covers creating windows on it and switching to it.
$ACCESS = 0x01FF
$CREATE_NEW_CONSOLE = 0x00000010

function Win32Error { [Runtime.InteropServices.Marshal]::GetLastWin32Error() }

$CLOSE_TIMEOUT_S = 20
$LAUNCH_TIMEOUT_S = 20
$REPLY_TIMEOUT_MS = 5000
$POLL_MS = 400
$REPLY_BUFFER_BYTES = 4096

function Test-Endpoint {
  try {
    (Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 2).webSocketDebuggerUrl
  } catch { $null }
}

function Find-Chrome {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  throw 'chrome.exe not found in any of the standard install locations'
}

# Match the debugging port: nothing outside this launcher starts Chrome with it,
# so no browser the human owns can be caught. Renderers carry the flag too.
function Get-PortChrome {
  Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains("--remote-debugging-port=$Port")
  }
}

# Browser.close is an orderly shutdown, unlike killing the process, so the
# cookies of a sign-in made moments ago reach disk before the profile is reused.
function Close-Browser {
  $ws = Test-Endpoint
  if ($ws) {
    $none = [Threading.CancellationToken]::None
    $sock = New-Object Net.WebSockets.ClientWebSocket
    try {
      $sock.ConnectAsync([Uri]$ws, $none).Wait()
      $request = [Text.Encoding]::UTF8.GetBytes('{"id":1,"method":"Browser.close"}')
      $sock.SendAsync([ArraySegment[byte]]::new($request), [Net.WebSockets.WebSocketMessageType]::Text, $true, $none).Wait()
      $reply = [ArraySegment[byte]]::new((New-Object byte[] $REPLY_BUFFER_BYTES))
      try { [void]$sock.ReceiveAsync($reply, $none).Wait($REPLY_TIMEOUT_MS) } catch {}
    } finally { $sock.Dispose() }
  }
  $deadline = (Get-Date).AddSeconds($CLOSE_TIMEOUT_S)
  while ((Get-PortChrome) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds $POLL_MS }
  if (Get-PortChrome) { throw "chrome on port $Port did not close within $CLOSE_TIMEOUT_S s" }
}

$chrome = Find-Chrome
$chromeArgs = @(
  "--remote-debugging-port=$Port"
  "--user-data-dir=`"$UserDataDir`""
  '--remote-allow-origins=*'
  '--no-first-run'
  '--no-default-browser-check'
  '--window-size=1440,900'
  # A window on a desktop nobody looks at counts as occluded, and Chrome would
  # otherwise stop painting it and throttle its timers.
  '--disable-backgrounding-occluded-windows'
  '--disable-renderer-backgrounding'
  '--disable-background-timer-throttling'
) -join ' '

if ($Stop) {
  try { Close-Browser } catch { Get-PortChrome | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
  Write-Output "chrome on port $Port closed"
  return
}

# -Show and -Hide restart the one browser every session shares, so they refuse
# while any session has a page open in it, unless -Force says that is known.
function Assert-Idle {
  if ($Force -or -not (Test-Endpoint)) { return }
  # Windows PowerShell passes a JSON array down the pipeline as one object, so
  # it is assigned first to be filtered element by element.
  $pages = Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 2
  $open = @($pages | Where-Object {
    $_.type -eq 'page' -and $_.url -notmatch '^chrome(-untrusted)?://'
  })
  if ($open.Count) {
    throw "pages are open in the shared browser; pass -Force once they are known to be idle:`n$(($open | ForEach-Object { $_.url }) -join "`n")"
  }
}

if ($Show) {
  Assert-Idle
  Close-Browser
  Start-Process -FilePath $chrome -ArgumentList "$chromeArgs $Url"
  $deadline = (Get-Date).AddSeconds($LAUNCH_TIMEOUT_S)
  while (-not (Test-Endpoint) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds $POLL_MS }
  if (-not (Test-Endpoint)) { throw "chrome did not open port $Port on the desktop" }
  Write-Output "chrome is a normal window on your desktop; -Hide -Force puts it back when signed in"
  return
}

if ($Hide) {
  Assert-Idle
  Close-Browser
}

$ws = Test-Endpoint
if ($ws) {
  Write-Output "already up on port $Port"
  Write-Output $ws
  return
}

$handle = [Win.Desktops]::OpenDesktop($Desktop, 0, $false, $ACCESS)
if ($handle -eq [IntPtr]::Zero) {
  $handle = [Win.Desktops]::CreateDesktop($Desktop, [IntPtr]::Zero, [IntPtr]::Zero, 0, $ACCESS, [IntPtr]::Zero)
}
if ($handle -eq [IntPtr]::Zero) {
  throw "could not open or create desktop '$Desktop' (win32 $(Win32Error))"
}

$si =New-Object Win.Desktops+STARTUPINFO
$si.cb = [Runtime.InteropServices.Marshal]::SizeOf([type][Win.Desktops+STARTUPINFO])
$si.lpDesktop = "WinSta0\$Desktop"
$pi = New-Object Win.Desktops+PROCESS_INFORMATION

# Nobody on the hidden desktop listens, so pages there, such as replays with music, stay silent.
$cmdLine = New-Object Text.StringBuilder("`"$chrome`" $chromeArgs --mute-audio")
$ok = [Win.Desktops]::CreateProcess(
  [IntPtr]::Zero, $cmdLine, [IntPtr]::Zero, [IntPtr]::Zero, $false,
  $CREATE_NEW_CONSOLE, [IntPtr]::Zero, [IntPtr]::Zero, [ref]$si, [ref]$pi)

if (-not $ok) {
  $err = Win32Error
  [void][Win.Desktops]::CloseDesktop($handle)
  throw "CreateProcess failed (win32 $err)"
}
[void][Win.Desktops]::CloseHandle($pi.hThread)
[void][Win.Desktops]::CloseHandle($pi.hProcess)

# Hold the desktop handle until Chrome has a thread on it, otherwise the object
# is destroyed the moment this script's last reference goes away. Watching the
# pid as well as the port means a Chrome that aborts on startup is reported
# straight away instead of after the full timeout.
$deadline = (Get-Date).AddSeconds($LAUNCH_TIMEOUT_S)
do {
  Start-Sleep -Milliseconds $POLL_MS
  $ws = Test-Endpoint
  $alive = $null -ne (Get-Process -Id $pi.dwProcessId -ErrorAction SilentlyContinue)
} while (-not $ws -and $alive -and (Get-Date) -lt $deadline)

[void][Win.Desktops]::CloseDesktop($handle)

if (-not $ws) {
  throw @"
chrome did not open port $Port. The usual cause is another chrome.exe already
holding ${UserDataDir}: Chrome's process singleton is per profile directory and
cannot be found from another desktop, so the second one aborts rather than
relaying its arguments. Close that Chrome, or pass a different -UserDataDir.
"@
}

Write-Output "chrome pid $($pi.dwProcessId) on desktop '$Desktop', profile $UserDataDir"
Write-Output $ws
