$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\tools\install-support.ps1')
$sandbox = Join-Path $PSScriptRoot ('..\work\qa-stage6\installer-' + [guid]::NewGuid().ToString('N'))
$pluginDirectory = Join-Path $sandbox '插件 包含空格'
$installationDirectory = Join-Path $sandbox 'Fake Installation'
$profileDirectory = Join-Path $sandbox 'isolated-profile'
foreach ($directory in @($pluginDirectory, (Join-Path $pluginDirectory 'tools'), (Join-Path $pluginDirectory 'lib'), $installationDirectory, $profileDirectory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
foreach ($file in @((Join-Path $installationDirectory 'DeepSeek Harness.exe'), (Join-Path $pluginDirectory 'tools\desktop-cli.mjs'), (Join-Path $pluginDirectory 'lib\client.js'), (Join-Path $pluginDirectory 'lib\index.js'))) { Set-Content -LiteralPath $file -Value 'fixture only' -Encoding utf8 }
Set-Content -LiteralPath (Join-Path $pluginDirectory 'package.json') -Value '{"name":"dsh-reply-beautify","version":"test"}' -Encoding utf8
$profileFile = Join-Path $profileDirectory 'package.json'
Set-Content -LiteralPath $profileFile -Value '{"name":"isolated","dependencies":{"unrelated":"1.2.3"},"dsh":{"profile":{"bundles":["unrelated"]}}}' -Encoding utf8
Set-Content -LiteralPath (Join-Path $profileDirectory 'pnpm-lock.yaml') -Value 'fixture lock' -Encoding utf8
$assertions = 0
function Assert-Contract { param([bool]$Condition,[string]$Message); if(-not $Condition){ throw $Message }; $script:assertions++ }
Assert-Contract ((Get-DshDesktopProfilePath -DshHome '' -UserDirectory $sandbox) -eq [IO.Path]::GetFullPath((Join-Path $sandbox '.dsh\profiles\desktop'))) 'default profile path wrong'
Assert-Contract ((Get-DshDesktopProfilePath -DshHome (Join-Path $sandbox '自定义 Home') -UserDirectory $sandbox) -eq [IO.Path]::GetFullPath((Join-Path $sandbox '自定义 Home\profiles\desktop'))) 'DSH_HOME profile path ignored'
$plan = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $installationDirectory -ProfileDirectory $profileDirectory
Assert-Contract ($plan.Action -eq 'add' -and -not $plan.Linked) 'read-only plan wrong'
Assert-Contract (-not (Test-Path -LiteralPath (Join-Path $pluginDirectory 'backups'))) 'planning created a backup'
Assert-Contract ($plan.Arguments[-2] -eq '--offline' -and $plan.Arguments[-1] -eq '--ignore-scripts') 'offline/safe-script flags lost'
Assert-Contract ($plan.Arguments[1] -eq (Join-Path ([IO.Path]::GetFullPath($pluginDirectory)) 'tools\desktop-cli.mjs')) 'Unicode/spaced CLI argument split'
$before = (Get-FileHash -LiteralPath $profileFile -Algorithm SHA256).Hash
$blocked = $false
try { Invoke-DshInstallOperation -Plan $plan -IsRunning $true -RunCommand { throw 'must never run' } } catch { $blocked = $_.Exception.Message.Contains('Fully quit') }
Assert-Contract $blocked 'running app was not refused'
Assert-Contract (-not (Test-Path -LiteralPath (Join-Path $pluginDirectory 'backups'))) 'refusal changed profile/backup'
$oldMode = $env:ELECTRON_RUN_AS_NODE
try {
    $env:ELECTRON_RUN_AS_NODE = 'fixture-parent'
    $script:argumentsSeen = $null
    $add = Invoke-DshInstallOperation -Plan $plan -IsRunning $false -RunCommand {
        param($ExePath,$Arguments)
        $script:argumentsSeen = $Arguments
        Assert-Contract ($env:ELECTRON_RUN_AS_NODE -eq '1') 'Electron mode not isolated'
        $data = Get-Content -LiteralPath $profileFile -Raw | ConvertFrom-Json
        $data.dependencies | Add-Member -NotePropertyName 'dsh-reply-beautify' -NotePropertyValue $Arguments[6]
        $data.dsh.profile.bundles += 'dsh-reply-beautify'
        $data | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $profileFile -Encoding utf8
        return 0
    }
    Assert-Contract ($env:ELECTRON_RUN_AS_NODE -eq 'fixture-parent') 'environment not restored after add'
    Assert-Contract ((Get-FileHash -LiteralPath (Join-Path $add.ProfileBackup 'package.json') -Algorithm SHA256).Hash -eq $before) 'profile backup was not exact'
    Assert-Contract ((Get-Content -LiteralPath $profileFile -Raw | ConvertFrom-Json).dependencies.unrelated -eq '1.2.3') 'unrelated dependency changed'
    Assert-Contract ($argumentsSeen[6].StartsWith('link:') -and $argumentsSeen[6].Contains('插件 包含空格')) 'local package argument corrupted'
    $checkLinked = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $installationDirectory -ProfileDirectory $profileDirectory
    Assert-Contract ($checkLinked.Linked -and $checkLinked.BundleRegistered) 'installed link/bundle check failed'
    $removePlan = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $installationDirectory -ProfileDirectory $profileDirectory -Uninstall
    Assert-Contract ($removePlan.Arguments[-2] -eq 'remove' -and $removePlan.Arguments[-1] -eq 'dsh-reply-beautify') 'remove command wrong'
    $removed = Invoke-DshInstallOperation -Plan $removePlan -IsRunning $false -RunCommand {
        param($ExePath,$Arguments)
        $data = Get-Content -LiteralPath $profileFile -Raw | ConvertFrom-Json
        $data.dependencies.PSObject.Properties.Remove('dsh-reply-beautify')
        $data.dsh.profile.bundles = @($data.dsh.profile.bundles | Where-Object { $_ -ne 'dsh-reply-beautify' })
        $data | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $profileFile -Encoding utf8
        return 0
    }
    Assert-Contract (Test-Path -LiteralPath (Join-Path $removed.ProfileBackup 'package.json')) 'remove has no backup'
    $afterRemove = Get-Content -LiteralPath $profileFile -Raw | ConvertFrom-Json
    Assert-Contract (-not $afterRemove.dependencies.'dsh-reply-beautify' -and $afterRemove.dependencies.unrelated -eq '1.2.3') 'remove changed unrelated package'
    $failed = $false
    try { Invoke-DshInstallOperation -Plan $plan -IsRunning $false -RunCommand { return 7 } } catch { $failed = $_.Exception.Message.Contains('7') -and $_.Exception.Message.Contains('Profile backup:') }
    Assert-Contract $failed 'native exit failure not reported with backup'
    Assert-Contract ($env:ELECTRON_RUN_AS_NODE -eq 'fixture-parent') 'environment not restored after failure'
} finally { $env:ELECTRON_RUN_AS_NODE = $oldMode }
@{ assertions=$assertions; passed=$true; mode='isolated fixture; actual DSH CLI not invoked'; sandbox=[IO.Path]::GetFullPath($sandbox) } | ConvertTo-Json
