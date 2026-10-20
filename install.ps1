[CmdletBinding(DefaultParameterSetName='Install')]
param(
    [Parameter(ParameterSetName='Remove')][switch]$Uninstall,
    [Parameter(ParameterSetName='Check')][switch]$Check,
    [string]$Installation
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'tools\install-support.ps1')
$installationPath = Resolve-DshInstallation -Installation $Installation
$plan = Get-DshInstallPlan -PluginRoot $PSScriptRoot -Installation $installationPath -ProfileDirectory (Get-DshDesktopProfilePath) -Uninstall:$Uninstall
$isRunning = [bool](Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'DeepSeek Harness' })
if ($Check) { $plan | Add-Member -NotePropertyName Running -NotePropertyValue $isRunning; $plan | ConvertTo-Json -Depth 4; return }
Write-Output "DSH $($plan.DshVersion) | $($plan.Executable) | Action: $($plan.Action)"
$result = Invoke-DshInstallOperation -Plan $plan -IsRunning $isRunning
Write-Output "Done. Restart DeepSeek Harness. Profile backup: $($result.ProfileBackup)"
