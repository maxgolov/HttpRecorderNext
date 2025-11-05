/**
 * VS Code Extension Test Runner
 * 
 * Downloads VS Code, unzips it, and runs the integration tests inside it.
 */

import { runTests } from '@vscode/test-electron';
import * as path from 'path';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // The workspace to open for testing
    const testWorkspace = path.resolve(extensionDevelopmentPath, '../../');

    console.log('Extension Development Path:', extensionDevelopmentPath);
    console.log('Extension Tests Path:', extensionTestsPath);
    console.log('Test Workspace:', testWorkspace);

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--disable-extensions', // Disable other extensions
        '--disable-gpu'
      ]
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
