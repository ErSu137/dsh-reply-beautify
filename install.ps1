[CmdletBinding(DefaultParameterSetName='Install')]
param([Parameter(ParameterSetName='Remove')][switch]$Uninstall, [Parameter(ParameterSetName='Check')][switch]$Check)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'tools\install-support.ps1')
$plan = Get-DshInstallPlan -PluginRoot $PSScriptRoot -Installation (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness') -ProfileDirectory (Get-DshDesktopProfilePath) -Uninstall:$Uninstall
$isRunning = [bool](Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'DeepSeek Harness' })
if ($Check) { $plan | Add-Member -NotePropertyName Running -NotePropertyValue $isRunning; $plan | ConvertTo-Json -Depth 4; return }
$result = Invoke-DshInstallOperation -Plan $plan -IsRunning $isRunning
Write-Output "Done. Restart DeepSeek Harness. Profile backup: $($result.ProfileBackup)"
