# Test Workspaces

This directory contains sample workspaces for testing framework detection.

## Structure

Each subdirectory represents a workspace with a specific test framework:

### JavaScript/TypeScript Frameworks

- **playwright-workspace/** - Playwright end-to-end testing
  - `package.json` with `@playwright/test` dependency
  - `playwright.config.ts` configuration
  - Sample test in `tests/example.spec.ts`

- **jest-workspace/** - Jest unit testing
  - `package.json` with `jest` dependency
  - `jest.config.js` configuration
  - Sample test in `src/math.test.ts`

### Python Frameworks

- **pytest-workspace/** - pytest testing
  - `pyproject.toml` with pytest configuration
  - Sample test in `tests/test_math.py`

### .NET Frameworks

- **nunit-workspace/** - NUnit testing
  - `Tests.csproj` with NUnit package references
  - Sample test in `MathTests.cs`

### Go Frameworks

- **go-workspace/** - Go native testing
  - `go.mod` module definition
  - Sample test in `math_test.go`

## Usage

These workspaces are used by the framework detection tests in `../suite/framework-detection.test.ts`.

The tests verify that:
1. Each detector correctly identifies its target framework
2. Detectors don't produce false positives
3. The orchestrator correctly categorizes frameworks
4. Caching works properly
5. Configuration options are respected

## Adding New Test Workspaces

To add a new test workspace:

1. Create a new directory: `mkdir <framework>-workspace`
2. Add minimal framework configuration files
3. Add at least one sample test file
4. Add test cases to `framework-detection.test.ts`

## Notes

- These are minimal "skeleton" workspaces - dependencies are NOT actually installed
- The detection logic only examines configuration files and file patterns
- Actual test execution is NOT required for detection testing
