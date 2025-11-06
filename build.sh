#!/bin/bash
#
# Unified build script for HttpRecorder Next (Linux/macOS)
#
# Usage:
#   ./build.sh              # Build everything
#   ./build.sh --clean      # Clean and build
#   ./build.sh --package    # Build and package
#   ./build.sh --skip-tests # Build without tests
#

set -e  # Exit on error

# Setup clean PATH with essential directories and our tools
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Add .NET if installed
if [ -d "$HOME/.dotnet" ]; then
    export PATH="$HOME/.dotnet:$PATH"
    export DOTNET_ROOT="$HOME/.dotnet"
fi

# Load nvm if installed
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    . "$NVM_DIR/nvm.sh"
    nvm use --lts 2>/dev/null || true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
write_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

write_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

write_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

write_error() {
    echo -e "${RED}✗ $1${NC}"
}

write_header() {
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════=${NC}"
    echo -e " ${1}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════=${NC}"
}

# Parse arguments
CLEAN=false
SKIP_TESTS=false
PACKAGE=false
CONFIGURATION="Release"

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --package)
            PACKAGE=true
            shift
            ;;
        --debug)
            CONFIGURATION="Debug"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--clean] [--skip-tests] [--package] [--debug]"
            exit 1
            ;;
    esac
done

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$SCRIPT_DIR"

write_header "HttpRecorder Next - Unified Build"
echo "Platform: $(uname -s)"
echo "Configuration: $CONFIGURATION"
echo ""

START_TIME=$(date +%s)

# ═══════════════════════════════════════════════════════════
# STEP 1: Clean (optional)
# ═══════════════════════════════════════════════════════════
if [ "$CLEAN" = true ]; then
    write_header "Cleaning Build Outputs"
    
    write_step "Cleaning .NET projects..."
    ~/.dotnet/dotnet clean "$REPO_ROOT/HttpRecorder.sln" -c "$CONFIGURATION"
    
    write_step "Cleaning Node.js projects..."
    rm -rf "$REPO_ROOT/extensions/traffic-recorder/node_modules"
    rm -rf "$REPO_ROOT/extensions/traffic-recorder/dist"
    
    write_success "Clean completed"
fi

# ═══════════════════════════════════════════════════════════
# STEP 2: Restore Dependencies
# ═══════════════════════════════════════════════════════════
write_header "Restoring Dependencies"

write_step "Restoring .NET packages..."
RESTORE_START=$(date +%s)
~/.dotnet/dotnet restore "$REPO_ROOT/HttpRecorder.sln" --verbosity minimal
~/.dotnet/dotnet restore "$REPO_ROOT/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj" --verbosity minimal
RESTORE_END=$(date +%s)
RESTORE_ELAPSED=$((RESTORE_END - RESTORE_START))
write_success ".NET packages restored in ${RESTORE_ELAPSED}s"

# Check if node_modules exists and is recent
NODE_MODULES_PATH="$REPO_ROOT/extensions/traffic-recorder/node_modules"
PACKAGE_JSON_PATH="$REPO_ROOT/extensions/traffic-recorder/package.json"
SKIP_NPM_INSTALL=false

if [ -d "$NODE_MODULES_PATH" ]; then
    if [ -f "$PACKAGE_JSON_PATH" ]; then
        NODE_MODULES_TIME=$(stat -c %Y "$NODE_MODULES_PATH" 2>/dev/null || stat -f %m "$NODE_MODULES_PATH" 2>/dev/null)
        PACKAGE_JSON_TIME=$(stat -c %Y "$PACKAGE_JSON_PATH" 2>/dev/null || stat -f %m "$PACKAGE_JSON_PATH" 2>/dev/null)
        
        if [ -n "$NODE_MODULES_TIME" ] && [ -n "$PACKAGE_JSON_TIME" ] && [ "$NODE_MODULES_TIME" -gt "$PACKAGE_JSON_TIME" ]; then
            write_step "Node.js packages already up-to-date (node_modules newer than package.json)"
            echo "  Use --clean to force reinstall"
            SKIP_NPM_INSTALL=true
        fi
    fi
fi

if [ "$SKIP_NPM_INSTALL" = false ]; then
    write_step "Restoring Node.js packages (this may take a while on WSL)..."
    cd "$REPO_ROOT/extensions/traffic-recorder"
    
    NPM_START=$(date +%s)
    echo "  Running: npm ci --loglevel=verbose"
    
    # Set DNS order for faster npm on WSL
    export NODE_OPTIONS="--dns-result-order=ipv4first"
    
    npm ci --loglevel=verbose
    
    NPM_END=$(date +%s)
    NPM_ELAPSED=$((NPM_END - NPM_START))
    
    cd "$REPO_ROOT"
    write_success "Node.js packages restored in ${NPM_ELAPSED}s"
    
    if [ "$NPM_ELAPSED" -gt 30 ]; then
        write_warn "npm install took over 30 seconds. Consider adding to ~/.bashrc:"
        echo "  export NODE_OPTIONS=--dns-result-order=ipv4first"
    fi
else
    write_success "Node.js packages already present (use --clean to force reinstall)"
fi

# ═══════════════════════════════════════════════════════════
# STEP 3: Build .NET Libraries
# ═══════════════════════════════════════════════════════════
write_header "Building .NET Libraries"

write_step "Building HttpRecorder library..."
~/.dotnet/dotnet build "$REPO_ROOT/HttpRecorder/HttpRecorder.csproj" -c "$CONFIGURATION" --no-restore
write_success "HttpRecorder built"

write_step "Building HttpRecorder.DevProxy plugin..."
~/.dotnet/dotnet build "$REPO_ROOT/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj" -c "$CONFIGURATION" --no-restore
write_success "HttpRecorder.DevProxy built"

# ═══════════════════════════════════════════════════════════
# STEP 4: Run .NET Tests
# ═══════════════════════════════════════════════════════════
if [ "$SKIP_TESTS" = false ]; then
    write_header "Running .NET Tests"
    
    write_step "Testing HttpRecorder (net9.0 only)..."
    ~/.dotnet/dotnet test "$REPO_ROOT/HttpRecorder.Tests/HttpRecorder.Tests.csproj" -c "$CONFIGURATION" --no-build --framework net9.0 --logger "console;verbosity=minimal"
    write_success ".NET tests passed"
else
    write_warn "Skipping .NET tests"
fi

# ═══════════════════════════════════════════════════════════
# STEP 5: Copy .NET DLLs to Extension
# ═══════════════════════════════════════════════════════════
write_header "Preparing Extension Dependencies"

PLUGINS_DIR="$REPO_ROOT/extensions/traffic-recorder/plugins"
mkdir -p "$PLUGINS_DIR"

write_step "Copying .NET DLLs to extension plugins folder..."

DLL_PATH1="$REPO_ROOT/DevProxyExtension/HttpRecorder.DevProxy/bin/$CONFIGURATION/net9.0/HttpRecorder.DevProxy.dll"
DLL_PATH2="$REPO_ROOT/HttpRecorder/bin/$CONFIGURATION/net9.0/HttpRecorder.dll"

if [ -f "$DLL_PATH1" ]; then
    cp "$DLL_PATH1" "$PLUGINS_DIR/"
    write_success "Copied HttpRecorder.DevProxy.dll"
else
    write_error "HttpRecorder.DevProxy.dll not found at $DLL_PATH1"
    exit 1
fi

if [ -f "$DLL_PATH2" ]; then
    cp "$DLL_PATH2" "$PLUGINS_DIR/"
    write_success "Copied HttpRecorder.dll"
else
    write_error "HttpRecorder.dll not found at $DLL_PATH2"
    exit 1
fi

# ═══════════════════════════════════════════════════════════
# STEP 6: Build VS Code Extension
# ═══════════════════════════════════════════════════════════
write_header "Building VS Code Extension"

write_step "Compiling TypeScript..."
cd "$REPO_ROOT/extensions/traffic-recorder"
npm run build
cd "$REPO_ROOT"
write_success "Extension built"

# ═══════════════════════════════════════════════════════════
# STEP 7: Run Extension Tests
# ═══════════════════════════════════════════════════════════
if [ "$SKIP_TESTS" = false ]; then
    write_header "Running Extension Tests"
    
    write_step "Testing VS Code extension (headless mode)..."
    cd "$REPO_ROOT/extensions/traffic-recorder"
    
    # Run headless on Linux using Xvfb
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Check if Xvfb is available
        if command -v Xvfb &> /dev/null; then
            export DISPLAY=:99
            Xvfb :99 -screen 0 1920x1080x24 &> /dev/null &
            XVFB_PID=$!
            sleep 2
            npm test
            TEST_EXIT=$?
            kill $XVFB_PID 2>/dev/null || true
            if [ $TEST_EXIT -ne 0 ]; then
                cd "$REPO_ROOT"
                exit $TEST_EXIT
            fi
        else
            write_warn "Xvfb not found - tests will run with UI visible"
            npm test
        fi
    else
        npm test
    fi
    
    cd "$REPO_ROOT"
    write_success "Extension tests passed"
else
    write_warn "Skipping extension tests"
fi

# ═══════════════════════════════════════════════════════════
# STEP 8: Package (optional)
# ═══════════════════════════════════════════════════════════
if [ "$PACKAGE" = true ]; then
    write_header "Creating Packages"
    
    # NuGet package
    write_step "Creating NuGet package..."
    NUPKG_DIR="$REPO_ROOT/DevProxyExtension/nupkg"
    mkdir -p "$NUPKG_DIR"
    
    ~/.dotnet/dotnet pack "$REPO_ROOT/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj" -c "$CONFIGURATION" --no-build -o "$NUPKG_DIR"
    
    NUPKG=$(find "$NUPKG_DIR" -name "*.nupkg" | head -n 1)
    if [ -n "$NUPKG" ]; then
        SIZE=$(du -h "$NUPKG" | cut -f1)
        write_success "NuGet package created: $(basename $NUPKG) ($SIZE)"
    fi
    
    # VSIX package
    write_step "Creating VSIX package..."
    cd "$REPO_ROOT/extensions/traffic-recorder"
    npx @vscode/vsce package --out traffic-cop.vsix
    
    VSIX=$(find . -name "*.vsix" | head -n 1)
    if [ -n "$VSIX" ]; then
        SIZE=$(du -h "$VSIX" | cut -f1)
        write_success "VSIX package created: $(basename $VSIX) ($SIZE)"
    fi
    cd "$REPO_ROOT"
fi

# ═══════════════════════════════════════════════════════════
# SUCCESS SUMMARY
# ═══════════════════════════════════════════════════════════
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════=${NC}"
echo -e " ${GREEN}✓ Build Completed Successfully!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════=${NC}"
echo ""
printf "Build Time: %02d:%02d\n" $MINUTES $SECONDS
echo "Configuration: $CONFIGURATION"
echo ""

if [ "$PACKAGE" = true ]; then
    echo -e "${CYAN}Artifacts:${NC}"
    echo "  • NuGet: DevProxyExtension/nupkg/"
    echo "  • VSIX:  extensions/traffic-recorder/traffic-cop.vsix"
    echo ""
fi

echo -e "${YELLOW}Next steps:${NC}"
if [ "$PACKAGE" = false ]; then
    echo "  • Package: ./build.sh --package"
fi
echo "  • Test locally: code --install-extension extensions/traffic-recorder/traffic-cop.vsix"
echo "  • Release: ./scripts/release.ps1"
echo ""
