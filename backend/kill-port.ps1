param(
  [Parameter(Mandatory = $true)]
  [int]$Port
)

$matches = netstat -ano | Select-String -Pattern (":$Port\s")
$pids = @()

foreach ($match in $matches) {
  $parts = ($match.Line -split '\s+') | Where-Object { $_ -ne '' }
  if ($parts.Count -lt 5) { continue }

  $state = $parts[3]
  $procId = $parts[4]

  if ($state -ne 'LISTENING') { continue }
  if ($procId -eq '0') { continue }
  if ($procId -notmatch '^\d+$') { continue }

  $pids += [int]$procId
}

$pids = $pids | Sort-Object -Unique

if (-not $pids -or $pids.Count -eq 0) {
  Write-Output "No LISTENING process found on port $Port."
  exit 0
}

foreach ($pid in $pids) {
  try {
    taskkill /PID $pid /F | Out-Null
    Write-Output "Killed PID $pid on port $Port."
  } catch {
    Write-Error "Failed to kill PID ${pid}: $($_.Exception.Message)"
    exit 1
  }
}

exit 0
