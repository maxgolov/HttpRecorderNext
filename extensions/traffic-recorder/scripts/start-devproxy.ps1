#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Start Dev Proxy with HttpRecorder plugin for traffic recording (Windows)

.DESCRIPTION
    This script checks for Dev Proxy installation via winget, installs if needed,
    and starts the proxy with the HttpRecorder extension enabled.
    Does NOT configure system-wide proxy - only starts Dev Proxy for Playwright to use.

.PARAMETER Port
    Port for Dev Proxy to listen on (default: 8000)

.PARAMETER ConfigFile
    Path to devproxyrc.json configuration file

.PARAMETER OutputDir
    Directory to save HAR recordings (default: ./recordings)

.EXAMPLE
    .\start-devproxy.ps1
    Start Dev Proxy with default settings

.EXAMPLE
    .\start-devproxy.ps1 -Port 9000 -OutputDir ./my-recordings
    Start Dev Proxy on custom port with custom output directory
#>

param(
    [int]$Port = 8000,
    [string]$ConfigFile = "../devproxyrc.json",
    [string]$OutputDir = "./.http-recorder",
    [switch]$UseBeta = $true,
    [switch]$UseLocal = $false
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $ColorInfo
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $ColorSuccess
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $ColorWarning
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $ColorError
}

function Test-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-WingetInstalled {
    try {
        $null = Get-Command winget -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Test-DevProxyInstalled {
    param([bool]$IsBeta = $true)
    
    $command = if ($IsBeta) { "devproxy-beta" } else { "devproxy" }
    try {
        $null = Get-Command $command -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Install-DevProxy {
    param([bool]$IsBeta = $true)
    
    $packageId = if ($IsBeta) { "DevProxy.DevProxy.Beta" } else { "DevProxy.DevProxy" }
    $versionName = if ($IsBeta) { "Beta" } else { "Stable" }
    
    Write-Info "Dev Proxy ($versionName) not found. Installing via winget..."
    
    if (-not (Test-WingetInstalled)) {
        Write-Error "winget is not installed. Please install Windows Package Manager first."
        Write-Info "Visit: https://learn.microsoft.com/windows/package-manager/winget/"
        exit 1
    }

    try {
        Write-Info "Running: winget install $packageId --accept-package-agreements --accept-source-agreements --silent"
        winget install $packageId --accept-package-agreements --accept-source-agreements --silent
        
        # Refresh PATH to include Dev Proxy
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        if (Test-DevProxyInstalled -IsBeta $IsBeta) {
            Write-Success "Dev Proxy ($versionName) installed successfully!"
        }
        else {
            Write-Warning "Dev Proxy installed but not in PATH. Please restart your terminal."
            Write-Info "You can also add it manually: C:\Program Files\Dev Proxy"
            exit 1
        }
    }
    catch {
        Write-Error "Failed to install Dev Proxy: $_"
        exit 1
    }
}

function Install-HttpRecorderPlugin {
    param(
        [string]$Version = "0.3.0",
        [switch]$Force,
        [switch]$UseLocalBuild = $false
    )
    
    $pluginDir = Join-Path $PSScriptRoot ".." "plugins"
    $pluginDll = Join-Path $pluginDir "HttpRecorder.DevProxy.dll"
    
    # Check if already installed
    if ((Test-Path $pluginDll) -and -not $Force) {
        Write-Info "HttpRecorder.DevProxy plugin already installed"
        Write-Info "Use -Force to reinstall"
        return
    }
    
    Write-Info "Installing HttpRecorder.DevProxy plugin..."
    
    # Create plugins directory
    New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
    
    # Check if dotnet is available
    try {
        $null = Get-Command dotnet -ErrorAction Stop
    }
    catch {
        Write-Error ".NET SDK not found. Please install .NET 9.0 SDK"
        Write-Info "Visit: https://dotnet.microsoft.com/download"
        exit 1
    }
    
    try {
        # Use local build if explicitly requested or in development environment
        if ($UseLocalBuild) {
            # Try Release build first, then Debug
            $localPaths = @(
                "../../DevProxyExtension/HttpRecorder.DevProxy/bin/Release/net9.0",
                "../../DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/net9.0"
            )
            
            $localBuildFound = $false
            foreach ($localPath in $localPaths) {
                $localPluginPath = Join-Path $PSScriptRoot $localPath "HttpRecorder.DevProxy.dll"
                if (Test-Path $localPluginPath) {
                    $buildType = if ($localPath -match "Release") { "Release" } else { "Debug" }
                    Write-Info "Using local $buildType build..."
                    $sourceDir = Split-Path $localPluginPath -Parent
                    Copy-Item -Path (Join-Path $sourceDir "*") -Destination $pluginDir -Force
                    Write-Success "HttpRecorder.DevProxy plugin installed from local $buildType build!"
                    Write-Info "Plugin location: $pluginDir"
                    $localBuildFound = $true
                    return
                }
            }
            
            if (-not $localBuildFound) {
                Write-Warning "Local build not found. Please build the plugin first:"
                Write-Info "  cd ../../DevProxyExtension"
                Write-Info "  dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj -c Release"
                Write-Info ""
                Write-Info "Falling back to NuGet installation..."
            }
        }
        
        # Install from NuGet
        Write-Info "Downloading HttpRecorder.DevProxy v$Version from NuGet..."
        $tempDir = Join-Path $env:TEMP "HttpRecorder-$(New-Guid)"
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
        
        Push-Location $tempDir
        try {
            # Create temporary project to restore package
            $tempCsproj = @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="HttpRecorder.DevProxy" Version="$Version" />
  </ItemGroup>
</Project>
"@
            $tempCsproj | Out-File -FilePath "temp.csproj" -Encoding UTF8
            
            # Restore packages
            Write-Info "Running: dotnet restore --no-cache"
            $restoreOutput = dotnet restore --no-cache 2>&1 | Out-String
            
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to restore package from NuGet"
                Write-Info $restoreOutput
                throw "Package 'HttpRecorder.DevProxy' version '$Version' not found on NuGet.org. It may take a few minutes after publishing for packages to be available."
            }
            
            # Find the downloaded package
            $packagePath = Get-ChildItem -Path "$env:USERPROFILE\.nuget\packages\httprecorder.devproxy" -Directory | 
                           Sort-Object Name -Descending | 
                           Select-Object -First 1
            
            if (-not $packagePath) {
                throw "Failed to locate downloaded package"
            }
            
            $libPath = Join-Path $packagePath.FullName "lib" "net9.0"
            
            if (-not (Test-Path $libPath)) {
                throw "Package structure invalid - lib/net9.0 not found"
            }
            
            # Copy plugin files
            Copy-Item -Path (Join-Path $libPath "*") -Destination $pluginDir -Force -Recurse
            
            Write-Success "HttpRecorder.DevProxy plugin installed from NuGet!"
            Write-Info "Plugin location: $pluginDir"
        }
        finally {
            Pop-Location
            Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    catch {
        Write-Error "Failed to install plugin: $_"
        Write-Info ""
        Write-Info "Alternative: Build from source"
        Write-Info "  cd ../../DevProxyExtension"
        Write-Info "  dotnet build HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj"
        Write-Info "  Copy files to: $pluginDir"
        exit 1
    }
}

function Start-DevProxyServer {
    param(
        [string]$ConfigPath,
        [int]$ProxyPort,
        [string]$RecordingsDir,
        [bool]$IsBeta = $true
    )

    # Create output directory if it doesn't exist
    if (-not (Test-Path $RecordingsDir)) {
        Write-Info "Creating output directory: $RecordingsDir"
        New-Item -ItemType Directory -Path $RecordingsDir -Force | Out-Null
    }

    # Resolve absolute paths
    $ConfigPath = Resolve-Path $ConfigPath -ErrorAction Stop
    $RecordingsDir = (Resolve-Path $RecordingsDir -ErrorAction SilentlyContinue) ?? (New-Item -ItemType Directory -Path $RecordingsDir -Force).FullName

    $command = if ($IsBeta) { "devproxy-beta" } else { "devproxy" }
    $versionName = if ($IsBeta) { "Beta" } else { "Stable" }

    Write-Info "Starting Dev Proxy ($versionName) with:"
    Write-Info "  Port: $ProxyPort"
    Write-Info "  Config: $ConfigPath"
    Write-Info "  Output: $RecordingsDir"
    Write-Info "  Command: $command"
    Write-Info ""
    Write-Info "Press Ctrl+C to stop the proxy"
    Write-Info "==================================="
    Write-Info ""

    try {
        # Start Dev Proxy (this will block until stopped)
        & $command --config-file $ConfigPath --port $ProxyPort
    }
    catch {
        Write-Error "Dev Proxy stopped: $_"
    }
}

# Main execution
Write-Info "Traffic Recorder - Dev Proxy Startup Script"
Write-Info "============================================"
Write-Info ""

# Check if Dev Proxy is installed
if (-not (Test-DevProxyInstalled -IsBeta $UseBeta)) {
    Install-DevProxy -IsBeta $UseBeta
}
else {
    $command = if ($UseBeta) { "devproxy-beta" } else { "devproxy" }
    $versionName = if ($UseBeta) { "Beta" } else { "Stable" }
    Write-Success "Dev Proxy ($versionName) is already installed"
    
    # Show version
    $version = & $command --version 2>&1
    Write-Info "Version: $version"
}

# Install/check HttpRecorder plugin
Install-HttpRecorderPlugin -UseLocalBuild:$UseLocal

# Start Dev Proxy
Write-Info ""
Start-DevProxyServer -ConfigPath $ConfigFile -ProxyPort $Port -RecordingsDir $OutputDir -IsBeta $UseBeta
