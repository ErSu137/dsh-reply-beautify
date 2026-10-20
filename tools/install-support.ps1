# Shared installer operations. Discovery reads standard locations and registry
# records only; no recursive drive search and no execution during -Check.
function ConvertTo-DshInstallationDirectory {
    param([Parameter(Mandatory)][string]$Path)
    $value = [Environment]::ExpandEnvironmentVariables($Path.Trim().Trim('"'))
    $fullPath = [IO.Path]::GetFullPath($value)
    if ([IO.Path]::GetFileName($fullPath) -ieq 'DeepSeek Harness.exe') { return [IO.Path]::GetDirectoryName($fullPath) }
    return $fullPath
}

function Get-DshInstallationCandidates {
    foreach ($parent in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if ($parent) { Join-Path $parent 'DeepSeek Harness' }
    }
    foreach ($key in @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\DeepSeek Harness.exe',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\DeepSeek Harness.exe',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\DeepSeek Harness.exe'
    )) {
        if (Test-Path -LiteralPath $key) {
            $item = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
            if ($item.'(default)') { $item.'(default)' }
        }
    }
    foreach ($key in @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
    )) {
        if (-not (Test-Path -LiteralPath $key)) { continue }
        foreach ($child in Get-ChildItem -LiteralPath $key -ErrorAction SilentlyContinue) {
            $item = Get-ItemProperty -LiteralPath $child.PSPath -ErrorAction SilentlyContinue
            if ($item.DisplayName -notmatch '^DeepSeek Harness(?:\s+\d.*)?$') { continue }
            if ($item.InstallLocation) { $item.InstallLocation }
            if ($item.DisplayIcon -match '^"([^"]+\.exe)"(?:,.*)?$|^(.+\.exe)(?:,.*)?$') {
                if ($matches[1]) { $matches[1] } else { $matches[2] }
            }
        }
    }
}

function Resolve-DshInstallation {
    param([string]$Installation, [string]$DefaultInstallation, [AllowEmptyCollection()][string[]]$CandidatePaths)
    $hint = "Specify the directory or executable, for example: .\install.ps1 -Check -Installation 'D:\DeepSeek Harness'. The same -Installation works for install and -Uninstall."
    if (-not [string]::IsNullOrWhiteSpace($Installation)) {
        $directory = ConvertTo-DshInstallationDirectory -Path $Installation
        if (-not (Test-Path -LiteralPath (Join-Path $directory 'DeepSeek Harness.exe') -PathType Leaf)) {
            throw "DeepSeek Harness.exe was not found in the specified installation: $directory. $hint"
        }
        return $directory
    }
    if (-not $DefaultInstallation -and $env:LOCALAPPDATA) { $DefaultInstallation = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness' }
    if ($DefaultInstallation) {
        $directory = ConvertTo-DshInstallationDirectory -Path $DefaultInstallation
        if (Test-Path -LiteralPath (Join-Path $directory 'DeepSeek Harness.exe') -PathType Leaf) { return $directory }
    }
    if (-not $PSBoundParameters.ContainsKey('CandidatePaths')) { $CandidatePaths = @(Get-DshInstallationCandidates) }
    $found = @{}
    foreach ($candidate in $CandidatePaths) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        try { $directory = ConvertTo-DshInstallationDirectory -Path $candidate } catch { continue }
        if (Test-Path -LiteralPath (Join-Path $directory 'DeepSeek Harness.exe') -PathType Leaf) { $found[$directory.TrimEnd('\','/')] = $directory }
    }
    if ($found.Count -eq 1) { return @($found.Values)[0] }
    if ($found.Count -gt 1) { throw "Multiple DSH installations found: $(@($found.Values) -join '; '). $hint" }
    throw "DeepSeek Harness could not be located in the default directory or registered installation locations. $hint"
}

function Get-DshExecutableVersion {
    param([Parameter(Mandatory)][string]$Executable)
    $info = [Diagnostics.FileVersionInfo]::GetVersionInfo($Executable)
    if ($info.ProductName -ne 'DeepSeek Harness') { throw "This executable is not identified as DeepSeek Harness: $Executable" }
    # FileVersion retains the rc suffix; ProductVersion may be only 0.2.1.0.
    return $info.FileVersion.Trim()
}

function Get-DshDesktopProfilePath {
    param([string]$DshHome = $env:DSH_HOME, [string]$UserDirectory = $env:USERPROFILE)
    $homeDirectory = if ([string]::IsNullOrWhiteSpace($DshHome)) { Join-Path $UserDirectory '.dsh' } else { $DshHome }
    Join-Path ([IO.Path]::GetFullPath($homeDirectory)) 'profiles\desktop'
}

function Get-DshInstallPlan {
    param([string]$PluginRoot, [string]$Installation, [string]$ProfileDirectory, [switch]$Uninstall,
        [scriptblock]$ReadVersion = { param($Executable) Get-DshExecutableVersion -Executable $Executable })
    $pluginPath = [IO.Path]::GetFullPath($PluginRoot)
    $installationPath = [IO.Path]::GetFullPath($Installation)
    $profilePath = [IO.Path]::GetFullPath($ProfileDirectory)
    $executablePath = Join-Path $installationPath 'DeepSeek Harness.exe'
    $bridgePath = Join-Path $pluginPath 'tools\desktop-cli.mjs'
    foreach ($path in @($executablePath, (Join-Path $installationPath 'resources\app.asar'), (Join-Path $installationPath 'resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs'), $bridgePath, (Join-Path $pluginPath 'lib\client.js'), (Join-Path $pluginPath 'lib\index.js'), (Join-Path $profilePath 'package.json'))) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required file not found: $path" }
    }
    $manifest = Get-Content -LiteralPath (Join-Path $pluginPath 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -ne 'dsh-reply-beautify') { throw 'Unexpected plugin package name.' }
    $expectedVersion = if ($manifest.engines.dsh) { $manifest.engines.dsh.TrimStart('=') } else { '0.2.1-rc.2' }
    $versionError = $null
    try { $dshVersion = [string](& $ReadVersion $executablePath) } catch { $dshVersion = ''; $versionError = $_.Exception.Message }
    $compatible = $dshVersion -eq $expectedVersion
    $profile = Get-Content -LiteralPath (Join-Path $profilePath 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $expectedLink = 'link:' + $pluginPath
    $installedLink = $profile.dependencies.'dsh-reply-beautify'
    $linked = [bool]($installedLink -and $installedLink.Replace('\','/').TrimEnd('/') -eq $expectedLink.Replace('\','/').TrimEnd('/'))
    $cliArguments = @('--expose-internals', $bridgePath, 'plugin', '--profile', 'desktop')
    if ($Uninstall) { $cliArguments += @('remove', 'dsh-reply-beautify') }
    else { $cliArguments += @('add', $expectedLink, '--offline', '--ignore-scripts') }
    [pscustomobject]@{ PluginRoot=$pluginPath; Version=$manifest.version; Installation=$installationPath; Executable=$executablePath; DshVersion=$dshVersion; ExpectedDshVersion=$expectedVersion; VersionCompatible=$compatible; VersionError=$versionError; ProfileDirectory=$profilePath; Action=$(if($Uninstall){'remove'}else{'add'}); Linked=$linked; BundleRegistered=[bool]($profile.dsh.profile.bundles -contains 'dsh-reply-beautify'); Arguments=$cliArguments }
}

function Invoke-DshInstallOperation {
    param([Parameter(Mandatory)]$Plan, [bool]$IsRunning, [scriptblock]$RunCommand = {
        param($ExecutablePath, $CliArguments)
        & $ExecutablePath @CliArguments | Out-Host
        return $LASTEXITCODE
    })
    if ($IsRunning) { throw 'Fully quit DeepSeek Harness first (App > Quit), then run this installer again.' }
    if ([string]::IsNullOrWhiteSpace($Plan.DshVersion) -or (-not $Plan.VersionCompatible -and $Plan.Action -ne 'remove')) {
        throw "DSH version could not be verified or is unsupported. Detected: '$($Plan.DshVersion)'; expected: '$($Plan.ExpectedDshVersion)'. Executable: $($Plan.Executable). $($Plan.VersionError) No profile changes were made."
    }
    if (-not $Plan.VersionCompatible) { Write-Warning "Removing the plugin using DSH '$($Plan.DshVersion)'; compatibility baseline is '$($Plan.ExpectedDshVersion)'." }
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
