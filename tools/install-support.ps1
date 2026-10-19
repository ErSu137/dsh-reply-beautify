# Shared installer operations. Parameters allow contract tests in an isolated
# directory; install.ps1 always supplies the actual desktop installation/profile.
function Get-DshDesktopProfilePath {
    param([string]$DshHome = $env:DSH_HOME, [string]$UserDirectory = $env:USERPROFILE)
    $homeDirectory = if ([string]::IsNullOrWhiteSpace($DshHome)) { Join-Path $UserDirectory '.dsh' } else { $DshHome }
    Join-Path ([IO.Path]::GetFullPath($homeDirectory)) 'profiles\desktop'
}

function Get-DshInstallPlan {
    param([string]$PluginRoot, [string]$Installation, [string]$ProfileDirectory, [switch]$Uninstall)
    $pluginPath = [IO.Path]::GetFullPath($PluginRoot)
    $installationPath = [IO.Path]::GetFullPath($Installation)
    $profilePath = [IO.Path]::GetFullPath($ProfileDirectory)
    $executablePath = Join-Path $installationPath 'DeepSeek Harness.exe'
    $bridgePath = Join-Path $pluginPath 'tools\desktop-cli.mjs'
    foreach ($path in @($executablePath, $bridgePath, (Join-Path $pluginPath 'lib\client.js'), (Join-Path $pluginPath 'lib\index.js'), (Join-Path $profilePath 'package.json'))) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required file not found: $path" }
    }
    $manifest = Get-Content -LiteralPath (Join-Path $pluginPath 'package.json') -Raw | ConvertFrom-Json
    if ($manifest.name -ne 'dsh-reply-beautify') { throw 'Unexpected plugin package name.' }
    $profile = Get-Content -LiteralPath (Join-Path $profilePath 'package.json') -Raw | ConvertFrom-Json
    $expectedLink = 'link:' + $pluginPath
    $installedLink = $profile.dependencies.'dsh-reply-beautify'
    $linked = [bool]($installedLink -and $installedLink.Replace('\','/').TrimEnd('/') -eq $expectedLink.Replace('\','/').TrimEnd('/'))
    $cliArguments = @('--expose-internals', $bridgePath, 'plugin', '--profile', 'desktop')
    if ($Uninstall) { $cliArguments += @('remove', 'dsh-reply-beautify') }
    else { $cliArguments += @('add', $expectedLink, '--offline', '--ignore-scripts') }
    [pscustomobject]@{ PluginRoot=$pluginPath; Version=$manifest.version; Executable=$executablePath; ProfileDirectory=$profilePath; Action=$(if($Uninstall){'remove'}else{'add'}); Linked=$linked; BundleRegistered=[bool]($profile.dsh.profile.bundles -contains 'dsh-reply-beautify'); Arguments=$cliArguments }
}

function Invoke-DshInstallOperation {
    param([Parameter(Mandatory)]$Plan, [bool]$IsRunning, [scriptblock]$RunCommand = {
        param($ExecutablePath, $CliArguments)
        & $ExecutablePath @CliArguments | Out-Host
        return $LASTEXITCODE
    })
    if ($IsRunning) { throw 'Fully quit DeepSeek Harness first (App > Quit), then run this installer again.' }
    $backupPath = Join-Path $Plan.PluginRoot ('backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
    New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
    foreach ($name in @('package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'pnpm-workspace.yaml')) {
        $sourcePath = Join-Path $Plan.ProfileDirectory $name
        if (Test-Path -LiteralPath $sourcePath -PathType Leaf) { Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $backupPath $name) }
    }
    $oldElectronMode = $env:ELECTRON_RUN_AS_NODE
    try {
        $env:ELECTRON_RUN_AS_NODE = '1'
        $resultCode = & $RunCommand $Plan.Executable $Plan.Arguments
        if ($resultCode -ne 0) { throw "DSH plugin command returned: $resultCode" }
    } catch {
        throw "DSH plugin operation failed: $($_.Exception.Message). Profile backup: $backupPath"
    } finally { $env:ELECTRON_RUN_AS_NODE = $oldElectronMode }
    [pscustomobject]@{ Action=$Plan.Action; ProfileBackup=$backupPath; Version=$Plan.Version }
}
