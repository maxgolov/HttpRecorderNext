#!/usr/bin/env bash
# Bump version across all relevant files

set -euo pipefail

NEW_VERSION="$1"

if [[ -z "$NEW_VERSION" ]]; then
    echo "❌ Usage: $0 <version>"
    echo "   Example: $0 1.0.0"
    exit 1
fi

# Validate semantic version format
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use: MAJOR.MINOR.PATCH (e.g., 1.0.0)"
    exit 1
fi

echo "🔄 Bumping version to $NEW_VERSION..."

# Get directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$(dirname "$EXTENSION_ROOT")")"

# Update package.json
PACKAGE_JSON="$EXTENSION_ROOT/package.json"
if [[ -f "$PACKAGE_JSON" ]]; then
    echo "  📝 Updating $PACKAGE_JSON"
    OLD_VERSION=$(grep -oP '(?<="version": ")[^"]*' "$PACKAGE_JSON")
    sed -i "s/\"version\": \"$OLD_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
    echo "  ✅ package.json: $OLD_VERSION → $NEW_VERSION"
fi

# Update HttpRecorder.DevProxy.csproj
CSPROJ="$WORKSPACE_ROOT/DevProxyExtension/HttpRecorder.DevProxy/HttpRecorder.DevProxy.csproj"
if [[ -f "$CSPROJ" ]]; then
    echo "  📝 Updating $CSPROJ"
    
    if grep -q "<Version>" "$CSPROJ"; then
        # Update existing Version node
        sed -i "s|<Version>.*</Version>|<Version>$NEW_VERSION</Version>|" "$CSPROJ"
    else
        # Add Version node after TargetFramework
        sed -i "/<TargetFramework>/ a\    <Version>$NEW_VERSION</Version>" "$CSPROJ"
    fi
    
    echo "  ✅ HttpRecorder.DevProxy.csproj: version set to $NEW_VERSION"
fi

# Update CHANGELOG.md
CHANGELOG="$WORKSPACE_ROOT/CHANGELOG.md"
if [[ -f "$CHANGELOG" ]]; then
    echo "  📝 Updating $CHANGELOG"
    DATE=$(date +%Y-%m-%d)
    
    # Create new version entry
    NEW_ENTRY="## [$NEW_VERSION] - $DATE

### Added
- 

### Changed
- 

### Fixed
- 

"
    
    # Insert after ## [Unreleased]
    if grep -q "## \[Unreleased\]" "$CHANGELOG"; then
        sed -i "/## \[Unreleased\]/a\\
\\
$NEW_ENTRY" "$CHANGELOG"
        echo "  ✅ CHANGELOG.md: Added entry for $NEW_VERSION"
    else
        echo "  ⚠️  CHANGELOG.md: Could not find [Unreleased] section"
    fi
fi

echo ""
echo "📦 Version bumped to $NEW_VERSION"
echo ""
echo "Next steps:"
echo "  1. Update CHANGELOG.md with changes"
echo "  2. Commit changes: git add -A && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "  3. Create tag: git tag -a v$NEW_VERSION -m 'Release v$NEW_VERSION'"
echo "  4. Push: git push && git push --tags"
echo "  5. Build and publish: bash scripts/build-and-install.sh"
