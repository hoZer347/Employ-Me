# Stop-hook audit: what did this session start and forget to close?
#
# Two kinds of leftover cost the human something. A tab on the shared Chrome
# (see CLAUDE.md, "Browser automation") keeps playing whatever it loaded, and a
# dev server keeps a port. Both have been left behind, so the check is here
# rather than in a rule nobody re-reads.
#
# It reports; it never kills. Other sessions share that browser and the user's
# own watchdog owns the long-lived servers, so deciding what is safe to close is
# the agent's job, with the list in hand.
#
# Blocks once per session (exit 2, message on stderr) and writes a marker, so a
# leftover that belongs to somebody else cannot hold the session in a loop.

$ErrorActionPreference = 'SilentlyContinue'

$stdin = [Console]::In.ReadToEnd()
$session = 'unknown'
if ($stdin) {
  try { $session = (ConvertFrom-Json $stdin).session_id } catch { }
}
if (-not $session) { $session = 'unknown' }

$marker = Join-Path $env:TEMP ("claude-leftovers-{0}.flag" -f ($session -replace '[^A-Za-z0-9_-]', '_'))
if (Test-Path $marker) { exit 0 }

$found = @()

# Pages on the shared browser pointed at a local server. A human signing into a
# site there is on a real domain, so localhost is the agent's own test tab.
try {
  $tabs = Invoke-RestMethod -Uri 'http://127.0.0.1:9333/json/list' -TimeoutSec 2
  foreach ($tab in $tabs) {
    if ($tab.type -eq 'page' -and $tab.url -match '^https?://(localhost|127\.0\.0\.1)') {
      $found += "  chrome tab {0}  {1}" -f $tab.id, $tab.url
    }
  }
} catch { }

# Dev servers, minus the ones the user's watchdog owns. Walk the parent chain
# rather than matching on port: the watchdog restarts its children, so a fresh
# pid under it is still the user's, not this session's.
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'"
$byPid = @{}
foreach ($p in (Get-CimInstance Win32_Process)) { $byPid[[int]$p.ProcessId] = $p }

function Test-Supervised([int]$processId) {
  $current = $processId
  for ($hop = 0; $hop -lt 6; $hop++) {
    $proc = $byPid[$current]
    if (-not $proc) { return $false }
    if ($proc.CommandLine -match 'keep-server-up\.ps1') { return $true }
    $current = [int]$proc.ParentProcessId
    if ($current -le 0) { return $false }
  }
  return $false
}

foreach ($p in $procs) {
  if ($p.CommandLine -notmatch 'vite|serve-site') { continue }
  if (Test-Supervised ([int]$p.ProcessId)) { continue }
  $found += "  node pid {0}  {1}" -f $p.ProcessId, $p.CommandLine.Trim()
}

if ($found.Count -eq 0) { exit 0 }

New-Item -ItemType File -Path $marker -Force | Out-Null

$message = @(
  "Leftovers from this session are still running. Close the ones this run opened, then finish:",
  ($found -join "`n"),
  "Close a tab with: curl -s http://127.0.0.1:9333/json/close/<id>",
  "Leave anything another session or the user owns, and say so."
) -join "`n"

[Console]::Error.WriteLine($message)
exit 2
