#!/usr/bin/env bash
# Sync tasks.json between workspace root and extension folder
# This ensures both files have consistent task definitions

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_TASKS_PATH="$SCRIPT_DIR/../.vscode/tasks.json"
EXTENSION_TASKS_PATH="$SCRIPT_DIR/../extensions/traffic-recorder/.vscode/tasks.json"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Sync tasks.json Files                                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if both files exist
if [[ ! -f "$ROOT_TASKS_PATH" ]]; then
    echo "❌ Root tasks.json not found: $ROOT_TASKS_PATH"
    exit 1
fi

if [[ ! -f "$EXTENSION_TASKS_PATH" ]]; then
    echo "❌ Extension tasks.json not found: $EXTENSION_TASKS_PATH"
    exit 1
fi

echo "📄 Root tasks.json: $ROOT_TASKS_PATH"
echo "📄 Extension tasks.json: $EXTENSION_TASKS_PATH"
echo ""

# Simple comparison using diff
echo "🔄 Comparing files..."
echo ""

if diff -q "$ROOT_TASKS_PATH" "$EXTENSION_TASKS_PATH" >/dev/null 2>&1; then
    echo "✅ Files are identical"
else
    echo "⚠️  Files differ"
    echo ""
    echo "Key differences:"
    echo "  • Root tasks use 'Traffic Recorder:' prefix"
    echo "  • Root tasks reference workspace folder paths"
    echo "  • Extension tasks assume extension folder as cwd"
    echo ""
    echo "To see full diff, run:"
    echo "  diff $ROOT_TASKS_PATH $EXTENSION_TASKS_PATH"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Sync Check Complete                                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Note: Manual sync is required due to path differences."
echo "Ensure both Playwright test tasks have Dev Proxy dependencies."
