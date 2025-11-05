#!/usr/bin/env bash
#
# Start Dev Proxy with HttpRecorder plugin for traffic recording (Linux/macOS)
#
# This script checks for Dev Proxy installation, installs if needed,
# and starts the proxy with the HttpRecorder extension enabled.
# Does NOT configure system-wide proxy - only starts Dev Proxy for Playwright to use.
#
# Usage:
#   ./start-devproxy.sh [port] [config-file] [output-dir]
#
# Example:
#   ./start-devproxy.sh 8000 ../devproxyrc.json ./recordings

set -euo pipefail

# Default parameters
PORT="${1:-8000}"
CONFIG_FILE="${2:-../devproxyrc.json}"
OUTPUT_DIR="${3:-./recordings}"

# Colors for output
COLOR_INFO='\033[0;36m'
COLOR_SUCCESS='\033[0;32m'
COLOR_WARNING='\033[0;33m'
COLOR_ERROR='\033[0;31m'
COLOR_RESET='\033[0m'

# Logging functions
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

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "macos"
            ;;
        Linux*)
            echo "linux"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Check if Dev Proxy is installed
is_devproxy_installed() {
    command -v devproxy &> /dev/null
}

# Install Dev Proxy on Linux
install_devproxy_linux() {
    log_info "Installing Dev Proxy for Linux..."
    
    # Check for wget or curl
    if command -v wget &> /dev/null; then
        DOWNLOAD_CMD="wget -O"
    elif command -v curl &> /dev/null; then
        DOWNLOAD_CMD="curl -L -o"
    else
        log_error "Neither wget nor curl is available. Please install one of them."
        exit 1
    fi
    
    # Download and install
    local INSTALL_SCRIPT="/tmp/install-devproxy.sh"
    log_info "Downloading Dev Proxy installation script..."
    
    $DOWNLOAD_CMD "$INSTALL_SCRIPT" https://aka.ms/devproxy/setup.sh
    chmod +x "$INSTALL_SCRIPT"
    
    log_info "Running installation script..."
    bash "$INSTALL_SCRIPT"
    
    # Clean up
    rm -f "$INSTALL_SCRIPT"
    
    if is_devproxy_installed; then
        log_success "Dev Proxy installed successfully!"
    else
        log_error "Dev Proxy installation failed. Please install manually."
        log_info "Visit: https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/get-started"
        exit 1
    fi
}

# Install Dev Proxy on macOS
install_devproxy_macos() {
    log_info "Installing Dev Proxy for macOS..."
    
    # Check for Homebrew
    if ! command -v brew &> /dev/null; then
        log_error "Homebrew is not installed. Please install it first."
        log_info "Visit: https://brew.sh/"
        exit 1
    fi
    
    # Install via Homebrew
    log_info "Running: brew install dev-proxy"
    brew install dev-proxy
    
    if is_devproxy_installed; then
        log_success "Dev Proxy installed successfully!"
    else
        log_error "Dev Proxy installation failed. Please install manually."
        exit 1
    fi
}

# Build HttpRecorder plugin
build_plugin() {
    log_info "Building HttpRecorder.DevProxy plugin..."
    
    local plugin_project="../../DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj"
    
    if [ ! -f "$plugin_project" ]; then
        log_error "Plugin project not found at: $plugin_project"
        log_info "Please ensure HttpRecorder.DevProxy project exists"
        exit 1
    fi
    
    local plugin_dir
    plugin_dir="$(dirname "$plugin_project")"
    
    pushd "$plugin_dir" > /dev/null
    
    log_info "Running: dotnet build --configuration Debug"
    if ! dotnet build --configuration Debug; then
        log_error "Failed to build plugin"
        popd > /dev/null
        exit 1
    fi
    
    log_success "HttpRecorder.DevProxy plugin built successfully!"
    popd > /dev/null
}

# Start Dev Proxy
start_devproxy() {
    local port=$1
    local config=$2
    local output=$3
    
    # Create output directory if it doesn't exist
    if [ ! -d "$output" ]; then
        log_info "Creating output directory: $output"
        mkdir -p "$output"
    fi
    
    # Resolve absolute paths
    config=$(realpath "$config")
    output=$(realpath "$output")
    
    log_info "Starting Dev Proxy with:"
    log_info "  Port: $port"
    log_info "  Config: $config"
    log_info "  Output: $output"
    log_info ""
    log_info "Press Ctrl+C to stop the proxy"
    log_info "==================================="
    log_info ""
    
    # Start Dev Proxy (this will block until stopped)
    devproxy --config-file "$config" --port "$port"
}

# Cleanup handler
cleanup() {
    log_info "Shutting down Dev Proxy..."
    exit 0
}

trap cleanup INT TERM

# Main execution
main() {
    log_info "Traffic Recorder - Dev Proxy Startup Script"
    log_info "============================================"
    log_info ""
    
    # Detect OS
    OS=$(detect_os)
    log_info "Detected OS: $OS"
    
    # Check if Dev Proxy is installed
    if ! is_devproxy_installed; then
        case $OS in
            macos)
                install_devproxy_macos
                ;;
            linux)
                install_devproxy_linux
                ;;
            *)
                log_error "Unsupported operating system"
                exit 1
                ;;
        esac
    else
        log_success "Dev Proxy is already installed"
        
        # Show version
        local version
        version=$(devproxy --version 2>&1 || echo "unknown")
        log_info "Version: $version"
    fi
    
    # Build HttpRecorder plugin
    build_plugin
    
    # Start Dev Proxy
    log_info ""
    start_devproxy "$PORT" "$CONFIG_FILE" "$OUTPUT_DIR"
}

main "$@"
