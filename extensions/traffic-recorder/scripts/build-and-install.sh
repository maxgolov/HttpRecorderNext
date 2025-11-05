#!/usr/bin/env bash
#
# Build and install Traffic Recorder VS Code extension (Linux/macOS)
#
# This script:
# 1. Installs npm dependencies
# 2. Builds the TypeScript extension
# 3. Builds the HttpRecorder.DevProxy plugin
# 4. Packages the extension as .vsix
# 5. Installs the extension in VS Code

set -euo pipefail

SKIP_TESTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Colors
COLOR_INFO='\033[0;36m'
COLOR_SUCCESS='\033[0;32m'
COLOR_WARNING='\033[0;33m'
COLOR_ERROR='\033[0;31m'
COLOR_RESET='\033[0m'

log_info() {
    echo -e "${COLOR_INFO}[INFO]${COLOR_RESET} $1"
}

log_success() {
    echo -e "${COLOR_SUCCESS}[SUCCESS]${COLOR_RESET} $1"
}

log_warning() {
    echo -e "${COLOR_WARNING}[WARNING]${COLOR_RESET} $1"
}

log_error() {
    echo -e "${COLOR_ERROR}[ERROR]${COLOR_RESET} $1"
}

log_info "╔════════════════════════════════════════════════════════════╗"
log_info "║  Traffic Recorder Extension - Build & Install             ║"
log_info "╚════════════════════════════════════════════════════════════╝"
log_info ""

# Get paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$(dirname "$EXTENSION_ROOT")")"
PLUGIN_PROJECT="$WORKSPACE_ROOT/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj"

log_info "Extension Root: $EXTENSION_ROOT"
log_info "Workspace Root: $WORKSPACE_ROOT"
log_info ""

# Step 1: Install npm dependencies
log_info "Step 1: Installing npm dependencies..."
cd "$EXTENSION_ROOT"
if ! npm install; then
    log_error "Failed to install dependencies"
    exit 1
fi
log_success "✓ Dependencies installed"

# Step 2: Build HttpRecorder.DevProxy plugin
log_info ""
log_info "Step 2: Building HttpRecorder.DevProxy plugin..."
if [ ! -f "$PLUGIN_PROJECT" ]; then
    log_error "Plugin project not found at: $PLUGIN_PROJECT"
    exit 1
fi

if ! dotnet build "$PLUGIN_PROJECT" --configuration Debug; then
    log_error "Failed to build plugin"
    exit 1
fi
log_success "✓ HttpRecorder.DevProxy plugin built"

# Step 3: Build TypeScript extension
log_info ""
log_info "Step 3: Building TypeScript extension..."
cd "$EXTENSION_ROOT"
if ! npm run build; then
    log_error "Failed to build extension"
    exit 1
fi
log_success "✓ Extension built"

# Step 4: Run tests (optional)
if [ "$SKIP_TESTS" = false ]; then
    log_info ""
    log_info "Step 4: Running extension tests..."
    cd "$EXTENSION_ROOT"
    if ! npm test; then
        log_warning "Tests failed, but continuing..."
    else
        log_success "✓ Tests passed"
    fi
else
    log_info ""
    log_info "Step 4: Skipping tests (--skip-tests specified)"
fi

# Step 5: Package extension
log_info ""
log_info "Step 5: Packaging extension..."
cd "$EXTENSION_ROOT"
if ! npm run package; then
    log_error "Failed to package extension"
    exit 1
fi

VSIX_FILE=$(ls -1 "$EXTENSION_ROOT"/*.vsix 2>/dev/null | head -n 1)
if [ -z "$VSIX_FILE" ]; then
    log_error "VSIX file not found"
    exit 1
fi
log_success "✓ Extension packaged: $(basename "$VSIX_FILE")"

# Step 6: Install extension
log_info ""
log_info "Step 6: Installing extension in VS Code..."
log_info "Running: code --install-extension $VSIX_FILE"

if ! code --install-extension "$VSIX_FILE" --force; then
    log_error "Failed to install extension"
    exit 1
fi
log_success "✓ Extension installed"

# Summary
log_info ""
log_success "╔════════════════════════════════════════════════════════════╗"
log_success "║  Build & Installation Complete! ✓                         ║"
log_success "╚════════════════════════════════════════════════════════════╝"
log_info ""
log_info "To use the extension:"
log_info "  1. Reload VS Code (Ctrl+Shift+P → 'Developer: Reload Window')"
log_info "  2. Run commands from Command Palette:"
log_info "     - 'Traffic Recorder: Start Dev Proxy'"
log_info "     - 'Traffic Recorder: Run Playwright Tests with Recording'"
log_info ""
log_info "Extension files located at: $EXTENSION_ROOT"
log_info "VSIX package: $(basename "$VSIX_FILE")"
log_info ""
