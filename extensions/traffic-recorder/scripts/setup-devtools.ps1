#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup DevTools integration for Traffic Recorder

.DESCRIPTION
    This script installs recommended VS Code extensions for DevTools integration
    and creates example configuration files.

.EXAMPLE
    .\setup-devtools.ps1
    Install all recommended extensions

.EXAMPLE
    .\setup-devtools.ps1 -Edge
    Install only Edge DevTools extension
#>

param(
    [switch]$Edge,
    [switch]$OpenDevTools,
    [switch]$All
)

$ErrorActionPreference = "Stop"

# Colors for output
$ColorInfo = "Cyan"
$ColorSuccess = "Green"
$ColorWarning = "Yellow"

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

function Install-VSCodeExtension {
    param(
        [string]$ExtensionId,
        [string]$Name
    )

    Write-Info "Installing $Name..."
    
    try {
        $output = code --install-extension $ExtensionId 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Name installed successfully!"
        } else {
            Write-Warning "$Name may already be installed or failed to install"
            Write-Host $output
        }
    }
    catch {
        Write-Warning "Failed to install $Name : $_"
    }
}

function Create-LaunchConfig {
    $workspaceRoot = Get-Location
    $vscodeDir = Join-Path $workspaceRoot ".vscode"
    $launchPath = Join-Path $vscodeDir "launch.json"
    
    if (-not (Test-Path $vscodeDir)) {
        New-Item -ItemType Directory -Path $vscodeDir | Out-Null
        Write-Info "Created .vscode directory"
    }
    
    if (Test-Path $launchPath) {
        Write-Warning "launch.json already exists. Skipping creation."
        Write-Info "See .vscode/launch.example.json for reference configuration"
        return
    }
    
    $examplePath = Join-Path $PSScriptRoot ".." ".vscode" "launch.example.json"
    
    if (Test-Path $examplePath) {
        Copy-Item $examplePath $launchPath
        Write-Success "Created launch.json from example"
    } else {
        Write-Warning "Example launch.json not found. Please create manually."
    }
}

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Traffic Recorder - DevTools Integration Setup            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Determine which extensions to install
$installEdge = $Edge -or $All -or (-not $Edge -and -not $OpenDevTools)
$installOpenDevTools = $OpenDevTools -or $All

# Install extensions
if ($installEdge) {
    Write-Info ""
    Write-Info "Installing Microsoft Edge DevTools Extension..."
    Write-Info "This provides integrated Edge browser with DevTools in VS Code"
    Write-Info ""
    
    Install-VSCodeExtension -ExtensionId "ms-edgedevtools.vscode-edge-devtools" -Name "Microsoft Edge DevTools"
}

if ($installOpenDevTools) {
    Write-Info ""
    Write-Info "Installing Open DevTools Extension..."
    Write-Info "This allows opening DevTools for running Chrome/Edge instances"
    Write-Info ""
    
    Install-VSCodeExtension -ExtensionId "fabiospampinato.vscode-open-devtools" -Name "Open DevTools"
}

# Optional: Install Dev Proxy Toolkit
Write-Info ""
$installDevProxyToolkit = Read-Host "Install Dev Proxy Toolkit extension? (Y/n)"
if ($installDevProxyToolkit -ne "n" -and $installDevProxyToolkit -ne "N") {
    Install-VSCodeExtension -ExtensionId "garrytrinder.dev-proxy-toolkit" -Name "Dev Proxy Toolkit"
}

# Create launch configuration
Write-Info ""
Write-Info "Creating launch configuration..."
Create-LaunchConfig

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Setup Complete!                                           ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Info "Next steps:"
Write-Host "  1. Reload VS Code to activate extensions" -ForegroundColor Gray
Write-Host "  2. Review .vscode/launch.json configuration" -ForegroundColor Gray
Write-Host "  3. Press F5 to launch Edge with Dev Proxy" -ForegroundColor Gray
Write-Host "  4. View traffic in both Edge DevTools and HAR files" -ForegroundColor Gray
Write-Host ""
Write-Info "Documentation: docs/DEVTOOLS-INTEGRATION.md"
Write-Host ""
