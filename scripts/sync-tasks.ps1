#!/usr/bin/env pwsh
# Sync tasks.json between workspace root and extension folder
# This ensures both files have consistent task definitions

$RootTasksPath = Join-Path $PSScriptRoot ".." ".vscode" "tasks.json"
$ExtensionTasksPath = Join-Path $PSScriptRoot ".." "extensions" "traffic-recorder" ".vscode" "tasks.json"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Sync tasks.json Files                                     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if both files exist
if (-not (Test-Path $RootTasksPath)) {
    Write-Host "❌ Root tasks.json not found: $RootTasksPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ExtensionTasksPath)) {
    Write-Host "❌ Extension tasks.json not found: $ExtensionTasksPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Root tasks.json: $RootTasksPath" -ForegroundColor Gray
Write-Host "📄 Extension tasks.json: $ExtensionTasksPath" -ForegroundColor Gray
Write-Host ""

# Read both files
$RootTasks = Get-Content $RootTasksPath -Raw | ConvertFrom-Json
$ExtensionTasks = Get-Content $ExtensionTasksPath -Raw | ConvertFrom-Json

# Create a mapping of root tasks by label
$RootTaskMap = @{}
foreach ($task in $RootTasks.tasks) {
    $RootTaskMap[$task.label] = $task
}

# Create a mapping of extension tasks by label
$ExtensionTaskMap = @{}
foreach ($task in $ExtensionTasks.tasks) {
    $ExtensionTaskMap[$task.label] = $task
}

# Find tasks that should be synced (Traffic Recorder tasks)
$TrafficRecorderTasks = @(
    "Traffic Recorder: Start Dev Proxy (Windows)",
    "Traffic Recorder: Start Dev Proxy (Linux/Mac)",
    "Traffic Recorder: Run Playwright Tests",
    "Traffic Recorder: Setup",
    "Traffic Recorder: Full Test Run with Recording"
)

# Map root task labels to extension task labels
$TaskLabelMapping = @{
    "Traffic Recorder: Start Dev Proxy (Windows)" = "Start Dev Proxy (Windows)"
    "Traffic Recorder: Start Dev Proxy (Linux/Mac)" = "Start Dev Proxy (Linux/Mac)"
    "Traffic Recorder: Run Playwright Tests" = "Run Playwright Tests"
    "Traffic Recorder: Setup" = "Setup Traffic Recorder"
    "Traffic Recorder: Full Test Run with Recording" = "Full Test Run with Recording"
}

Write-Host "🔄 Syncing Traffic Recorder tasks..." -ForegroundColor Cyan
Write-Host ""

$SyncedCount = 0
$SkippedCount = 0

foreach ($rootLabel in $TrafficRecorderTasks) {
    $extensionLabel = $TaskLabelMapping[$rootLabel]
    
    if ($RootTaskMap.ContainsKey($rootLabel) -and $ExtensionTaskMap.ContainsKey($extensionLabel)) {
        $rootTask = $RootTaskMap[$rootLabel]
        $extensionTask = $ExtensionTaskMap[$extensionLabel]
        
        # Compare key properties
        $rootJson = $rootTask | ConvertTo-Json -Depth 10
        $extensionJson = $extensionTask | ConvertTo-Json -Depth 10
        
        if ($rootJson -ne $extensionJson) {
            Write-Host "  ⚠️  Tasks differ: $rootLabel ↔ $extensionLabel" -ForegroundColor Yellow
            Write-Host "      Consider manually reviewing differences" -ForegroundColor Gray
            $SkippedCount++
        } else {
            Write-Host "  ✅ Tasks match: $rootLabel ↔ $extensionLabel" -ForegroundColor Green
            $SyncedCount++
        }
    } elseif ($RootTaskMap.ContainsKey($rootLabel)) {
        Write-Host "  ℹ️  Task only in root: $rootLabel" -ForegroundColor Cyan
        $SkippedCount++
    } elseif ($ExtensionTaskMap.ContainsKey($extensionLabel)) {
        Write-Host "  ℹ️  Task only in extension: $extensionLabel" -ForegroundColor Cyan
        $SkippedCount++
    }
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✅ Matching tasks: $SyncedCount" -ForegroundColor Green
Write-Host "  ⚠️  Tasks needing review: $SkippedCount" -ForegroundColor Yellow
Write-Host ""

# Check for dependency consistency
Write-Host "🔗 Checking task dependencies..." -ForegroundColor Cyan
Write-Host ""

$PlaywrightRootTask = $RootTaskMap["Traffic Recorder: Run Playwright Tests"]
$PlaywrightExtTask = $ExtensionTaskMap["Run Playwright Tests"]

if ($PlaywrightRootTask.dependsOn -and $PlaywrightExtTask.dependsOn) {
    Write-Host "  ✅ Both Playwright tasks have dependencies" -ForegroundColor Green
    Write-Host "     Root: $($PlaywrightRootTask.dependsOn -join ', ')" -ForegroundColor Gray
    Write-Host "     Extension: $($PlaywrightExtTask.dependsOn -join ', ')" -ForegroundColor Gray
} elseif ($PlaywrightRootTask.dependsOn) {
    Write-Host "  ✅ Root Playwright task has dependencies" -ForegroundColor Green
    Write-Host "  ⚠️  Extension Playwright task missing dependencies" -ForegroundColor Yellow
} elseif ($PlaywrightExtTask.dependsOn) {
    Write-Host "  ⚠️  Root Playwright task missing dependencies" -ForegroundColor Yellow
    Write-Host "  ✅ Extension Playwright task has dependencies" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Neither Playwright task has dependencies" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Sync Check Complete                                       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Note: This script compares tasks but does not auto-sync them." -ForegroundColor Gray
Write-Host "Manual review is recommended to ensure compatibility." -ForegroundColor Gray
Write-Host ""
Write-Host "Key differences between root and extension tasks.json:" -ForegroundColor Cyan
Write-Host "  • Root tasks use 'Traffic Recorder:' prefix" -ForegroundColor Gray
Write-Host "  • Root tasks have absolute workspace paths" -ForegroundColor Gray
Write-Host "  • Extension tasks assume extension folder as cwd" -ForegroundColor Gray
