$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\tools\install-support.ps1')
$sandbox = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('..\work\qa-stage6\installer-' + [guid]::NewGuid().ToString('N'))))
$pluginDirectory = Join-Path $sandbox '插件 包含空格'
$installationDirectory = Join-Path $sandbox 'Fake Installation'
$profileDirectory = Join-Path $sandbox 'isolated-profile'
foreach ($directory in @($pluginDirectory, (Join-Path $pluginDirectory 'tools'), (Join-Path $pluginDirectory 'lib'), (Join-Path $installationDirectory 'resources\runtime\primary-runtime\dependencies\pnpm\bin'), $profileDirectory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
foreach ($file in @((Join-Path $installationDirectory 'DeepSeek Harness.exe'), (Join-Path $installationDirectory 'resources\app.asar'), (Join-Path $installationDirectory 'resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs'), (Join-Path $pluginDirectory 'tools\desktop-cli.mjs'), (Join-Path $pluginDirectory 'lib\client.js'), (Join-Path $pluginDirectory 'lib\index.js'))) { Set-Content -LiteralPath $file -Value 'fixture only' -Encoding utf8 }
Set-Content -LiteralPath (Join-Path $pluginDirectory 'package.json') -Value '{"name":"dsh-reply-beautify","version":"test"}' -Encoding utf8
$profileFile = Join-Path $profileDirectory 'package.json'
Set-Content -LiteralPath $profileFile -Value '{"name":"isolated","dependencies":{"unrelated":"1.2.3"},"dsh":{"profile":{"bundles":["unrelated"]}}}' -Encoding utf8
Set-Content -LiteralPath (Join-Path $profileDirectory 'pnpm-lock.yaml') -Value 'fixture lock' -Encoding utf8
$assertions = 0
function Assert-Contract { param([bool]$Condition,[string]$Message); if(-not $Condition){ throw $Message }; $script:assertions++ }
Assert-Contract ((Get-DshDesktopProfilePath -DshHome '' -UserDirectory $sandbox) -eq [IO.Path]::GetFullPath((Join-Path $sandbox '.dsh\profiles\desktop'))) 'default profile path wrong'
Assert-Contract ((Get-DshDesktopProfilePath -DshHome (Join-Path $sandbox '自定义 Home') -UserDirectory $sandbox) -eq [IO.Path]::GetFullPath((Join-Path $sandbox '自定义 Home\profiles\desktop'))) 'DSH_HOME profile path ignored'
$fixtureVersion = { param($Executable) '0.2.1-rc.2' }
$plan = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $installationDirectory -ProfileDirectory $profileDirectory -ReadVersion $fixtureVersion
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
    $checkLinked = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $installationDirectory -ProfileDirectory $profileDirectory -ReadVersion $fixtureVersion
    Assert-Contract ($checkLinked.Linked -and $checkLinked.BundleRegistered) 'installed link/bundle check failed'
    $removePlan = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $installationDirectory -ProfileDirectory $profileDirectory -Uninstall -ReadVersion $fixtureVersion
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

# Resolution and preflight are shared by every public parameter set.
$entry = Join-Path $PSScriptRoot '..\install.ps1'
foreach ($set in (Get-Command $entry).ParameterSets) {
    Assert-Contract ($set.Parameters.Name -contains 'Installation') "Installation missing from $($set.Name) parameter set"
}
$missing = Join-Path $sandbox 'missing'
$resolvedDefault = Resolve-DshInstallation -DefaultInstallation $installationDirectory -CandidatePaths @($missing)
Assert-Contract ($resolvedDefault -eq [IO.Path]::GetFullPath($installationDirectory)) 'default installation not selected'
$resolvedCustom = Resolve-DshInstallation -DefaultInstallation $missing -CandidatePaths @($missing,$installationDirectory,(Join-Path $installationDirectory 'DeepSeek Harness.exe'))
Assert-Contract ($resolvedCustom -eq $resolvedDefault) 'registered fallback or duplicate removal failed'
$discovery = (Get-Item Function:\Get-DshInstallationCandidates).ScriptBlock
try {
    function Get-DshInstallationCandidates { $installationDirectory }
    Assert-Contract ((Resolve-DshInstallation -DefaultInstallation $missing) -eq $resolvedDefault) 'automatic discovery was not used when default missing'
} finally { Set-Item Function:\Get-DshInstallationCandidates -Value $discovery }
Assert-Contract ((Resolve-DshInstallation -Installation (Join-Path $installationDirectory 'DeepSeek Harness.exe') -DefaultInstallation $missing -CandidatePaths @()) -eq $resolvedDefault) 'executable path not accepted'
$badExplicit = $false
try { Resolve-DshInstallation -Installation $missing -DefaultInstallation $installationDirectory } catch { $badExplicit = $_.Exception.Message.Contains('-Installation') -and $_.Exception.Message.Contains('specified') }
Assert-Contract $badExplicit 'invalid explicit path silently fell back'
$notFound = $false
try { Resolve-DshInstallation -DefaultInstallation $missing -CandidatePaths @() } catch { $notFound = $_.Exception.Message.Contains('-Installation') -and $_.Exception.Message.Contains('-Uninstall') }
Assert-Contract $notFound 'missing installation did not give actionable usage'

$custom = Join-Path $sandbox 'Custom [space] & directory\DeepSeek Harness'
New-Item -ItemType Directory -Path (Split-Path $custom) -Force | Out-Null
Copy-Item -LiteralPath $installationDirectory -Destination $custom -Recurse
$explicit = Resolve-DshInstallation -Installation $custom -DefaultInstallation $installationDirectory
Assert-Contract ($explicit -eq [IO.Path]::GetFullPath($custom)) 'explicit path did not override default'
$ambiguous = $false
try { Resolve-DshInstallation -DefaultInstallation $missing -CandidatePaths @($custom,$installationDirectory) } catch { $ambiguous = $_.Exception.Message.Contains('Multiple') -and $_.Exception.Message.Contains('-Installation') }
Assert-Contract $ambiguous 'multiple installations were selected without a choice'
$oldTestRoot = $env:DSH_INSTALLER_TEST_ROOT
try {
    $env:DSH_INSTALLER_TEST_ROOT = $custom
    Assert-Contract ((Resolve-DshInstallation -Installation '%DSH_INSTALLER_TEST_ROOT%') -eq $explicit) 'environment path expansion failed'
} finally { $env:DSH_INSTALLER_TEST_ROOT = $oldTestRoot }

foreach ($selected in @($resolvedDefault,$explicit)) {
    foreach ($remove in @($false,$true)) {
        $pathPlan = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $selected -ProfileDirectory $profileDirectory -Uninstall:$remove -ReadVersion $fixtureVersion
        Assert-Contract ($pathPlan.Executable -eq (Join-Path $selected 'DeepSeek Harness.exe') -and $pathPlan.VersionCompatible -and $pathPlan.DshVersion -eq '0.2.1-rc.2') 'path/version preflight wrong'
        $script:exeSeen = $null
        $script:cliSeen = $null
        $null = Invoke-DshInstallOperation -Plan $pathPlan -IsRunning $false -RunCommand {
            param($Executable,$Arguments)
            $script:exeSeen = $Executable; $script:cliSeen = $Arguments
            return 0
        }
        Assert-Contract ($exeSeen -eq $pathPlan.Executable -and $cliSeen[5] -eq $(if($remove){'remove'}else{'add'})) 'install/uninstall did not use selected executable'
    }
}

$backupCount = @(Get-ChildItem -LiteralPath (Join-Path $pluginDirectory 'backups') -Directory).Count
foreach ($reader in @({ param($Executable) '0.9.0' }, { param($Executable) throw 'metadata unavailable' })) {
    $unsupported = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $custom -ProfileDirectory $profileDirectory -ReadVersion $reader
    Assert-Contract (-not $unsupported.VersionCompatible) 'unsupported/unknown version accepted'
    $refused = $false
    try { Invoke-DshInstallOperation -Plan $unsupported -IsRunning $false -RunCommand { throw 'must never execute' } } catch { $refused = $_.Exception.Message.Contains('No profile changes') -and $_.Exception.Message.Contains('0.2.1-rc.2') }
    Assert-Contract $refused 'unsupported version did not stop before execution'
}
Assert-Contract (@(Get-ChildItem -LiteralPath (Join-Path $pluginDirectory 'backups') -Directory).Count -eq $backupCount) 'version refusal created backups'
$unknownRemove = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $custom -ProfileDirectory $profileDirectory -Uninstall -ReadVersion { param($Executable) throw 'not a DSH executable' }
$unknownRefused = $false
try { Invoke-DshInstallOperation -Plan $unknownRemove -IsRunning $false -RunCommand { throw 'must never execute' } } catch { $unknownRefused = $_.Exception.Message.Contains('No profile changes') }
Assert-Contract $unknownRefused 'uninstall executed an unidentified application'
$removeUnsupported = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $custom -ProfileDirectory $profileDirectory -Uninstall -ReadVersion { param($Executable) '0.9.0' }
$null = Invoke-DshInstallOperation -Plan $removeUnsupported -IsRunning $false -RunCommand { return 0 } -WarningAction SilentlyContinue
Assert-Contract ($removeUnsupported.Action -eq 'remove') 'version change prevented cleanup'
$pnpm = Join-Path $custom 'resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
Remove-Item -LiteralPath $pnpm
$incomplete = $false
try { Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $custom -ProfileDirectory $profileDirectory -ReadVersion $fixtureVersion } catch { $incomplete = $_.Exception.Message.Contains('pnpm.mjs') }
Assert-Contract $incomplete 'incomplete desktop installation accepted'
Set-Content -LiteralPath $pnpm -Value 'fixture only' -Encoding utf8

$utf8Profile = Join-Path $sandbox 'utf8-no-bom-profile'
New-Item -ItemType Directory -Path $utf8Profile -Force | Out-Null
$utf8Data = @{dependencies=@{'dsh-reply-beautify'=('link:'+$pluginDirectory.Replace('\','/'))};dsh=@{profile=@{bundles=@('dsh-reply-beautify')}}} | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText((Join-Path $utf8Profile 'package.json'),$utf8Data,[Text.UTF8Encoding]::new($false))
$utf8Plan = Get-DshInstallPlan -PluginRoot $pluginDirectory -Installation $custom -ProfileDirectory $utf8Profile -ReadVersion $fixtureVersion
Assert-Contract ($utf8Plan.Linked -and $utf8Plan.BundleRegistered) 'UTF-8 without BOM corrupted a Unicode link in Windows PowerShell'

# Exercise the actual public script with isolated environment and text fixtures.
# -Check must report metadata problems without executing the fake executable.
Copy-Item -LiteralPath $entry -Destination (Join-Path $pluginDirectory 'install.ps1')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\tools\install-support.ps1') -Destination (Join-Path $pluginDirectory 'tools\install-support.ps1')
$oldLocal = $env:LOCALAPPDATA; $oldHome = $env:DSH_HOME
try {
    $env:LOCALAPPDATA = Join-Path $sandbox 'local-app-data'
    $env:DSH_HOME = Join-Path $sandbox 'entry-home'
    $entryProfile = Join-Path $env:DSH_HOME 'profiles\desktop'
    New-Item -ItemType Directory -Path $entryProfile -Force | Out-Null
    Copy-Item -LiteralPath $profileFile -Destination (Join-Path $entryProfile 'package.json')
    $entryBefore = (Get-FileHash -LiteralPath (Join-Path $entryProfile 'package.json')).Hash
    $entryBackupCount = @(Get-ChildItem -LiteralPath (Join-Path $pluginDirectory 'backups') -Directory).Count
    $entryScript = Join-Path $pluginDirectory 'install.ps1'
    foreach ($chosen in @($custom,(Join-Path $custom 'DeepSeek Harness.exe'))) {
        $result = (& $entryScript -Check -Installation $chosen | Out-String) | ConvertFrom-Json
        Assert-Contract ($result.Executable -eq (Join-Path $custom 'DeepSeek Harness.exe') -and $result.ProfileDirectory -eq $entryProfile) 'public -Check lost explicit path or DSH_HOME'
        Assert-Contract (-not $result.VersionCompatible -and $result.VersionError) 'public -Check did not expose invalid executable metadata'
    }
    $defaultDirectory = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'
    New-Item -ItemType Directory -Path (Split-Path $defaultDirectory) -Force | Out-Null
    Copy-Item -LiteralPath $installationDirectory -Destination $defaultDirectory -Recurse
    $result = (& $entryScript -Check | Out-String) | ConvertFrom-Json
    Assert-Contract ($result.Executable -eq (Join-Path $defaultDirectory 'DeepSeek Harness.exe')) 'public default path failed'
    Assert-Contract ((Get-FileHash -LiteralPath (Join-Path $entryProfile 'package.json')).Hash -eq $entryBefore -and @(Get-ChildItem -LiteralPath (Join-Path $pluginDirectory 'backups') -Directory).Count -eq $entryBackupCount) 'public -Check changed profile/backups'
} finally { $env:LOCALAPPDATA = $oldLocal; $env:DSH_HOME = $oldHome }
@{ assertions=$assertions; passed=$true; mode='isolated fixture; actual DSH CLI not invoked'; sandbox=[IO.Path]::GetFullPath($sandbox) } | ConvertTo-Json
