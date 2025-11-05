/**
 * Traffic Recorder VS Code Extension
 * 
 * This extension provides commands to:
 * - Start/stop Dev Proxy with HttpRecorder plugin
 * - Run Playwright tests with traffic recording
 * - Install Dev Proxy if not present
 */

import { ChildProcess, execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { HARViewerProvider } from './harViewer';

const execFileAsync = promisify(execFile);

type ProxyStatus = 'stopped' | 'starting' | 'started' | 'stopping';

interface DevProxyState {
  process: ChildProcess | null;
  status: ProxyStatus;
  port: number;
  host: string;
  outputDir: string;
  useBeta: boolean;
  startTime?: Date;
}

const BRAILLE_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerInterval: NodeJS.Timeout | null = null;
let spinnerIndex = 0;

let devProxyState: DevProxyState = {
  process: null,
  status: 'stopped',
  port: 8000,
  host: 'localhost',
  outputDir: '.http-recorder',
  useBeta: true
};

let treeDataProvider: TrafficRecorderTreeProvider;
let extensionContext: vscode.ExtensionContext;

class TrafficRecorderTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async checkPortStatus(): Promise<void> {
    // If we think it's started but the port is not in use, update status
    if (devProxyState.status === 'started') {
      const portInUse = await isPortInUse(devProxyState.port, devProxyState.host);
      if (!portInUse) {
        devProxyState.status = 'stopped';
        devProxyState.process = null;
        this.refresh();
      }
    }
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      return Promise.resolve(this.getRootItems());
    }
    return Promise.resolve([]);
  }

  private getRootItems(): TreeItem[] {
    const items: TreeItem[] = [];

    // Check port status asynchronously
    this.checkPortStatus();

    // Status with action button
    let statusLabel: string;
    let statusIcon: string;
    let statusIconColor: vscode.ThemeColor | undefined;
    let statusCommand: string | undefined;
    
    switch (devProxyState.status) {
      case 'starting':
        statusLabel = 'Starting...';
        statusIcon = 'loading~spin';
        statusIconColor = undefined;
        statusCommand = undefined; // Disabled during start
        break;
      case 'started':
        statusLabel = 'Stop';
        statusIcon = 'debug-stop';
        statusIconColor = undefined;
        statusCommand = 'traffic-recorder.stopProxy';
        break;
      case 'stopping':
        statusLabel = 'Stopping...';
        statusIcon = 'loading~spin';
        statusIconColor = undefined;
        statusCommand = undefined; // Disabled during stop
        break;
      case 'stopped':
      default:
        statusLabel = 'Start';
        statusIcon = 'circle-filled';
        statusIconColor = new vscode.ThemeColor('testing.iconFailed');
        statusCommand = 'traffic-recorder.startProxy';
        break;
    }

    const statusItem = new TreeItem(statusLabel, vscode.TreeItemCollapsibleState.None);
    if (statusIcon) {
      statusItem.iconPath = new vscode.ThemeIcon(statusIcon, statusIconColor);
    }
    if (statusCommand) {
      statusItem.command = {
        command: statusCommand,
        title: statusLabel
      };
    }
    items.push(statusItem);

    // Host/Port item
    const hostItem = new TreeItem(
      `${devProxyState.host}:${devProxyState.port}`,
      vscode.TreeItemCollapsibleState.None
    );
    hostItem.iconPath = new vscode.ThemeIcon('globe');
    items.push(hostItem);

    // Output directory item
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const outputDirDisplay = devProxyState.outputDir.startsWith('./') || devProxyState.outputDir.startsWith('.\\') 
      ? devProxyState.outputDir.substring(2) 
      : devProxyState.outputDir;
    const outputItem = new TreeItem(
      outputDirDisplay,
      vscode.TreeItemCollapsibleState.None
    );
    outputItem.iconPath = new vscode.ThemeIcon('folder');
    
    // Make it clickable to reveal in Explorer
    if (workspaceFolder) {
      const outputDirPath = path.join(workspaceFolder, devProxyState.outputDir);
      outputItem.resourceUri = vscode.Uri.file(outputDirPath);
      outputItem.command = {
        command: 'revealInExplorer',
        title: 'Reveal in Explorer',
        arguments: [vscode.Uri.file(outputDirPath)]
      };
    }
    
    items.push(outputItem);

    // Run tests button (only show if workspace has tests directory)
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const testsDir = path.join(workspaceRoot, 'tests');
      if (fs.existsSync(testsDir)) {
        const runTestsItem = new TreeItem('Run All Tests', vscode.TreeItemCollapsibleState.None);
        runTestsItem.iconPath = new vscode.ThemeIcon('beaker');
        runTestsItem.command = {
          command: 'traffic-recorder.runTests',
          title: 'Run All Tests'
        };
        items.push(runTestsItem);
      }
    }

    return items;
  }
}

class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

/**
 * Ensure output directory exists
 */
function ensureOutputDirectory(): void {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) return;

  const outputDir = path.join(workspaceFolder, devProxyState.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  }
}

/**
 * Copy plugin DLLs from extension to workspace .http-recorder/bin/plugins/
 * This creates a self-contained setup similar to Python virtualenv
 */
function copyPluginDLLs(workspaceFolder: string): void {
  const extensionPath = getExtensionDirectory();
  const sourcePluginsDir = path.join(extensionPath, 'plugins');
  const targetPluginsDir = path.join(workspaceFolder, '.http-recorder', 'bin', 'plugins');

  // Create target directory
  if (!fs.existsSync(targetPluginsDir)) {
    fs.mkdirSync(targetPluginsDir, { recursive: true });
    console.log(`Created plugins directory: ${targetPluginsDir}`);
  }

  // Copy DLL files (only our 2 DLLs - Dev Proxy already includes Titanium.Web.Proxy and BouncyCastle)
  const pluginFiles = [
    'HttpRecorder.DevProxy.dll',
    'HttpRecorder.dll'
  ];

  for (const file of pluginFiles) {
    const sourcePath = path.join(sourcePluginsDir, file);
    const targetPath = path.join(targetPluginsDir, file);

    // Only copy if source is newer or target doesn't exist
    if (fs.existsSync(sourcePath)) {
      let shouldCopy = !fs.existsSync(targetPath);
      
      if (!shouldCopy) {
        const sourceStats = fs.statSync(sourcePath);
        const targetStats = fs.statSync(targetPath);
        shouldCopy = sourceStats.mtime > targetStats.mtime;
      }

      if (shouldCopy) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Copied plugin: ${file}`);
      }
    } else {
      console.warn(`Plugin file not found: ${sourcePath}`);
    }
  }
}

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Traffic Recorder extension is now active');

  // Store extension context globally
  extensionContext = context;

  // Initialize configuration
  const config = vscode.workspace.getConfiguration('trafficRecorder');
  devProxyState.port = config.get<number>('devProxyPort', 8000);
  devProxyState.outputDir = config.get<string>('outputDirectory', '.http-recorder');
  devProxyState.useBeta = config.get<boolean>('useBetaVersion', true);

  // Create output directory
  ensureOutputDirectory();

  // Create and register Tree View provider
  treeDataProvider = new TrafficRecorderTreeProvider();
  const treeView = vscode.window.createTreeView('trafficRecorderStatus', {
    treeDataProvider: treeDataProvider
  });
  context.subscriptions.push(treeView);

  // Check if workspace has tests directory for "Run All Tests" command
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    const testsDir = path.join(workspaceRoot, 'tests');
    const hasTestsDir = fs.existsSync(testsDir);
    vscode.commands.executeCommand('setContext', 'trafficRecorder.hasTestsDir', hasTestsDir);
  }

  // Register HAR Viewer
  const harViewerDisposables = HARViewerProvider.register(context);
  context.subscriptions.push(...harViewerDisposables);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('traffic-recorder.startProxy', startProxy),
    vscode.commands.registerCommand('traffic-recorder.stopProxy', stopProxy),
    vscode.commands.registerCommand('traffic-recorder.runTests', runTests),
    vscode.commands.registerCommand('traffic-recorder.runCurrentTest', runCurrentTest),
    vscode.commands.registerCommand('traffic-recorder.installDevProxy', installDevProxy)
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(record) Dev Proxy';
  statusBarItem.command = 'traffic-recorder.startProxy';
  statusBarItem.tooltip = 'Start Dev Proxy';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar when proxy state changes
  const updateStatusBar = () => {
    if (devProxyState.status === 'started') {
      statusBarItem.text = '$(debug-stop) Dev Proxy (Running)';
      statusBarItem.command = 'traffic-recorder.stopProxy';
      statusBarItem.tooltip = 'Stop Dev Proxy';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      statusBarItem.text = '$(record) Dev Proxy';
      statusBarItem.command = 'traffic-recorder.startProxy';
      statusBarItem.tooltip = 'Start Dev Proxy';
      statusBarItem.backgroundColor = undefined;
    }
    treeDataProvider.refresh();
  };

  context.subscriptions.push({
    dispose: () => {
      if (devProxyState.process) {
        killProcessTree(devProxyState.process.pid!);
      }
    }
  });

  // Initial status bar update
  updateStatusBar();
}

/**
 * Extension deactivation
 */
export function deactivate() {
  if (devProxyState.process) {
    killProcessTree(devProxyState.process.pid!);
  }
}

/**
 * Start Dev Proxy command
 */
async function startProxy() {
  if (devProxyState.status !== 'stopped') {
    vscode.window.showWarningMessage('Dev Proxy is already running or starting');
    return;
  }

  // Set status to starting and start spinner animation
  devProxyState.status = 'starting';
  treeDataProvider.refresh();
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % BRAILLE_SPINNER.length;
    treeDataProvider.refresh();
  }, 80);

  try {
    // Get configuration
    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const host = config.get<string>('devProxyHost', 'localhost');
    const port = config.get<number>('devProxyPort', 8000);
    const outputDir = config.get<string>('outputDirectory', '.http-recorder');
    const useBeta = config.get<boolean>('useBetaVersion', true);
    const useLocalPlugin = config.get<boolean>('useLocalPlugin', false);
    const asSystemProxy = config.get<boolean>('asSystemProxy', false);

    // Update state
    devProxyState.host = host;
    devProxyState.port = port;
    devProxyState.outputDir = outputDir;
    devProxyState.useBeta = useBeta;
    devProxyState.startTime = new Date();

    // Ensure output directory exists
    ensureOutputDirectory();

    // Get workspace folder
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('Please open a workspace folder first');
      return;
    }

    // Check if Dev Proxy is installed
    const isInstalled = await isDevProxyInstalled();
    if (!isInstalled) {
      const install = await vscode.window.showWarningMessage(
        'Dev Proxy is not installed. Would you like to install it?',
        'Install',
        'Cancel'
      );
      
      if (install === 'Install') {
        await installDevProxy();
      } else {
        return;
      }
    }

    // Build HttpRecorder plugin (only if useLocalPlugin is true and we're in repo)
    if (useLocalPlugin) {
      const pluginProjectPath = path.join(workspaceFolder, 'DevProxyExtension', 'HttpRecorder.DevProxy', 'HttpRecorder.DevProxy.csproj');
      if (fs.existsSync(pluginProjectPath)) {
        await buildHttpRecorderPlugin(workspaceFolder);
      }
    }

    // Copy plugin DLLs to workspace .http-recorder/bin/plugins/
    // This creates a self-contained setup similar to Python virtualenv
    copyPluginDLLs(workspaceFolder);

    // Start Dev Proxy
    const extensionPath = getExtensionDirectory();
    
    // Use workspace config if it exists, otherwise create from template
    const workspaceConfigDir = path.join(workspaceFolder, '.http-recorder');
    const workspaceConfigPath = path.join(workspaceConfigDir, 'devproxyrc.json');
    const defaultConfigPath = path.join(extensionPath, 'devproxyrc.default.json');
    
    let configPath = workspaceConfigPath;
    
    // Create .http-recorder directory if it doesn't exist
    if (!fs.existsSync(workspaceConfigDir)) {
      fs.mkdirSync(workspaceConfigDir, { recursive: true });
    }
    
    // Create workspace config from template if it doesn't exist
    // The template now uses relative paths (./bin/plugins/...) instead of absolute paths
    if (!fs.existsSync(workspaceConfigPath)) {
      const defaultConfig = fs.readFileSync(defaultConfigPath, 'utf8');
      // No replacements needed - template already has relative paths
      fs.writeFileSync(workspaceConfigPath, defaultConfig);
    }
    
    const recordingsPath = workspaceConfigDir;

    // Create output channel for Dev Proxy logs
    const outputChannel = vscode.window.createOutputChannel('Dev Proxy');
    outputChannel.show();

    // Update workspace config with current settings (port, asSystemProxy)
    // Keep relative paths as-is - they work when Dev Proxy runs with cwd=.http-recorder
    try {
      const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      configContent.port = port;
      configContent.asSystemProxy = asSystemProxy;
      
      // Ensure plugin path stays relative
      if (configContent.plugins && configContent.plugins.length > 0) {
        const plugin = configContent.plugins[0];
        if (!plugin.pluginPath || plugin.pluginPath.includes('extensions')) {
          // Fix old absolute paths to relative
          plugin.pluginPath = './bin/plugins/HttpRecorder.DevProxy.dll';
        }
      }
      
      // Ensure output directory is relative (current directory)
      configContent.httpRecorder = configContent.httpRecorder || {};
      if (!configContent.httpRecorder.outputDirectory || configContent.httpRecorder.outputDirectory.includes('\\')) {
        configContent.httpRecorder.outputDirectory = '.';
      }
      
      fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    } catch (error) {
      outputChannel.appendLine(`Warning: Could not update config file: ${error}`);
    }

    outputChannel.appendLine('Starting Dev Proxy...');
    outputChannel.appendLine(`Port: ${port}`);
    outputChannel.appendLine(`Config: ${configPath}`);
    outputChannel.appendLine(`Output: ${recordingsPath}`);
    outputChannel.appendLine('');

    // Start the proxy process directly (no PowerShell script needed)
    let proxyProcess: ChildProcess;
    
    const devProxyCommand = useBeta ? 'devproxy-beta' : 'devproxy';
    // Use just the filename since Dev Proxy will run from .http-recorder directory
    const args = [
      '--config-file', 'devproxyrc.json',
      '--port', port.toString()
    ];

    outputChannel.appendLine(`Command: ${devProxyCommand} ${args.join(' ')}`);
    outputChannel.appendLine(`Working directory: ${workspaceConfigDir}`);
    outputChannel.appendLine('');

    proxyProcess = spawn(devProxyCommand, args, {
      cwd: workspaceConfigDir, // Run from .http-recorder so relative paths work
      shell: true, // Use shell to resolve command in PATH
      windowsHide: false
    });

    // Handle process output
    proxyProcess.stdout?.on('data', (data) => {
      outputChannel.append(data.toString());
    });

    proxyProcess.stderr?.on('data', (data) => {
      outputChannel.append(data.toString());
    });

    proxyProcess.on('error', (error) => {
      outputChannel.appendLine(`Error: ${error.message}`);
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
      }
      devProxyState.status = 'stopped';
      devProxyState.process = null;
      treeDataProvider.refresh();
      updateStatusBar();
    });

    proxyProcess.on('exit', (code) => {
      outputChannel.appendLine(`Dev Proxy exited with code ${code}`);
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
      }
      devProxyState.status = 'stopped';
      devProxyState.process = null;
      treeDataProvider.refresh();
      updateStatusBar();
    });

    devProxyState.process = proxyProcess;
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    devProxyState.status = 'started';
    devProxyState.port = port;
    treeDataProvider.refresh();
    updateStatusBar();

    vscode.window.showInformationMessage(`Dev Proxy started on port ${port}`);

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to start Dev Proxy: ${error}`);
  }
}

/**
 * Stop Dev Proxy command
 */
async function stopProxy() {
  if (devProxyState.status !== 'started' || !devProxyState.process) {
    vscode.window.showWarningMessage('Dev Proxy is not running');
    return;
  }

  // Set status to stopping and start spinner animation
  devProxyState.status = 'stopping';
  treeDataProvider.refresh();
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % BRAILLE_SPINNER.length;
    treeDataProvider.refresh();
  }, 80);

  try {
    killProcessTree(devProxyState.process.pid!);
    devProxyState.process = null;
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    devProxyState.status = 'stopped';
    treeDataProvider.refresh();
    updateStatusBar();
    vscode.window.showInformationMessage('Dev Proxy stopped');
  } catch (error) {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    devProxyState.status = 'stopped';
    treeDataProvider.refresh();
    vscode.window.showErrorMessage(`Failed to stop Dev Proxy: ${error}`);
  }
}

/**
 * Run Playwright tests command
 */
async function runTests() {
  try {
    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const autoStart = config.get<boolean>('autoStart', false);

    // Check if proxy is actually running on the port
    const portInUse = await isPortInUse(devProxyState.port, devProxyState.host);
    
    // Update status if mismatch detected
    if (devProxyState.status === 'started' && !portInUse) {
      devProxyState.status = 'stopped';
      devProxyState.process = null;
      treeDataProvider.refresh();
    } else if (devProxyState.status === 'stopped' && portInUse) {
      devProxyState.status = 'started';
      treeDataProvider.refresh();
    }

    // Auto-start proxy if enabled and not running
    if (autoStart && !portInUse) {
      await startProxy();
      // Wait for proxy to start
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Check if proxy is running
    if (!portInUse) {
      const start = await vscode.window.showWarningMessage(
        'Dev Proxy is not running. Start it now?',
        'Start & Run Tests',
        'Cancel'
      );

      if (start === 'Start & Run Tests') {
        await startProxy();
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        return;
      }
    }

    // Get workspace folder
    const workspaceFolder = getWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('Please open a workspace folder first');
      return;
    }

    // Search for Playwright test files in the workspace
    const testFiles = await vscode.workspace.findFiles(
      '**/*.{spec,test}.ts',
      '**/node_modules/**'
    );

    if (testFiles.length === 0) {
      vscode.window.showWarningMessage('No Playwright test files found in workspace');
      return;
    }

    // Check if playwright.config.ts exists
    const playwrightConfig = await vscode.workspace.findFiles('**/playwright.config.ts', '**/node_modules/**');
    
    if (playwrightConfig.length === 0) {
      vscode.window.showWarningMessage('No playwright.config.ts found in workspace');
      return;
    }

    // Use the directory containing playwright.config.ts as the working directory
    const configDir = path.dirname(playwrightConfig[0].fsPath);

    // Check if Playwright is installed
    if (!await isPlaywrightInstalled(configDir)) {
      await promptInstallPlaywright(configDir);
      return;
    }

    // Create terminal for Playwright
    const terminal = vscode.window.createTerminal({
      name: 'Playwright Tests',
      cwd: configDir
    });

    terminal.show();
    terminal.sendText('npx playwright test');

    vscode.window.showInformationMessage(
      `Running ${testFiles.length} Playwright test file(s) with traffic recording...`,
      'View Output'
    ).then(selection => {
      if (selection === 'View Output') {
        const outputDir = path.join(configDir, devProxyState.outputDir);
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputDir));
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run tests: ${error}`);
  }
}

/**
 * Run current test file with Dev Proxy
 */
async function runCurrentTest() {
  try {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
      vscode.window.showErrorMessage('No active editor. Please open a test file.');
      return;
    }

    const filePath = editor.document.uri.fsPath;
    const fileName = path.basename(filePath);
    const fileContent = editor.document.getText();

    // Debug: log the filename
    console.log('Checking file:', fileName);

    // Check if file is a test file
    if (!fileName.match(/\.(spec|test)\.ts$/)) {
      vscode.window.showWarningMessage(`Current file is not a Playwright test file (.spec.ts or .test.ts). File: ${fileName}`);
      return;
    }

    // Check if file contains Playwright imports
    const hasPlaywrightImport = /from\s+['"]@playwright\/test['"]/.test(fileContent) ||
                                /require\s*\(\s*['"]@playwright\/test['"]\s*\)/.test(fileContent);
    
    if (!hasPlaywrightImport) {
      vscode.window.showWarningMessage('Current file does not appear to be a Playwright test (no @playwright/test import found)');
      return;
    }

    // Save file if dirty
    if (editor.document.isDirty) {
      await editor.document.save();
    }

    // Check if Dev Proxy is installed
    if (!await isDevProxyInstalled()) {
      const result = await vscode.window.showErrorMessage(
        'Dev Proxy is not installed.',
        'Install Now',
        'Cancel'
      );

      if (result === 'Install Now') {
        await installDevProxy();
        return;
      }
      return;
    }

    // Auto-start Dev Proxy if not running
    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const autoStart = config.get<boolean>('autoStart', false);
    
    if (devProxyState.status !== 'started') {
      const shouldStart = autoStart || await vscode.window.showInformationMessage(
        'Dev Proxy is not running. Start it now?',
        'Yes',
        'No'
      ) === 'Yes';

      if (shouldStart) {
        await startProxy();
        // Wait a bit for proxy to start
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    // Find the directory containing playwright.config.ts by searching upwards from the test file
    let testRunDir = path.dirname(filePath);
    let playwrightConfigFound = false;
    
    // Search up to 5 levels up for playwright.config.ts
    for (let i = 0; i < 5; i++) {
      const configPath = path.join(testRunDir, 'playwright.config.ts');
      if (fs.existsSync(configPath)) {
        playwrightConfigFound = true;
        console.log('Found playwright.config.ts at:', testRunDir);
        break;
      }
      const parentDir = path.dirname(testRunDir);
      if (parentDir === testRunDir) break; // Reached root
      testRunDir = parentDir;
    }

    if (!playwrightConfigFound) {
      vscode.window.showErrorMessage('Could not find playwright.config.ts. Make sure it exists in the test directory or above.');
      return;
    }

    // Check if Playwright is installed in the correct directory
    if (!await isPlaywrightInstalled(testRunDir)) {
      await promptInstallPlaywright(testRunDir);
      return;
    }

    // Get relative path from the test run directory with forward slashes for Playwright
    const relativePath = path.relative(testRunDir, filePath).replace(/\\/g, '/');

    // Create terminal for running the test
    const terminal = vscode.window.createTerminal({
      name: `Test: ${fileName}`,
      cwd: testRunDir
    });

    terminal.show();
    
    // Run Playwright with the specific file (use forward slashes and proper quoting)
    terminal.sendText(`npx playwright test ${relativePath} --headed`);

    vscode.window.showInformationMessage(`Running test: ${fileName}`, 'View Output Directory').then(selection => {
      if (selection === 'View Output Directory') {
        const outputDir = path.join(workspaceFolder, devProxyState.outputDir);
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputDir));
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run test: ${error}`);
  }
}

/**
 * Install Dev Proxy command
 */
async function installDevProxy() {
  try {
    const outputChannel = vscode.window.createOutputChannel('Dev Proxy Installation');
    outputChannel.show();

    outputChannel.appendLine('Installing Dev Proxy...');

    if (process.platform === 'win32') {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      const useBeta = config.get<boolean>('useBetaVersion', true);
      const packageId = useBeta ? 'DevProxy.DevProxy.Beta' : 'DevProxy.DevProxy';
      
      outputChannel.appendLine(`Using winget to install Dev Proxy ${useBeta ? '(Beta)' : '(Stable)'}...`);
      
      const { stdout, stderr } = await execFileAsync('winget', [
        'install',
        packageId,
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--silent'
      ]);

      outputChannel.appendLine(stdout);
      if (stderr) {
        outputChannel.appendLine(stderr);
      }
    } else if (process.platform === 'darwin') {
      outputChannel.appendLine('Using Homebrew to install Dev Proxy...');
      
      const { stdout, stderr } = await execFileAsync('brew', ['install', 'dev-proxy']);
      
      outputChannel.appendLine(stdout);
      if (stderr) {
        outputChannel.appendLine(stderr);
      }
    } else {
      outputChannel.appendLine('Downloading Dev Proxy installation script...');
      
      const { stdout, stderr } = await execFileAsync('bash', [
        '-c',
        'curl -L https://aka.ms/devproxy/setup.sh | bash'
      ]);
      
      outputChannel.appendLine(stdout);
      if (stderr) {
        outputChannel.appendLine(stderr);
      }
    }

    vscode.window.showInformationMessage('Dev Proxy installed successfully!');

  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to install Dev Proxy: ${error.message}`);
  }
}

/**
 * Helper: Check if Dev Proxy is installed
 */
async function isDevProxyInstalled(): Promise<boolean> {
  const useBeta = vscode.workspace.getConfiguration('trafficRecorder').get<boolean>('useBetaVersion', true);
  const command = useBeta ? 'devproxy-beta' : 'devproxy';
  
  try {
    await execFileAsync(command, ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper: Check if Playwright is installed in the workspace
 */
async function isPlaywrightInstalled(workspaceDir: string): Promise<boolean> {
  // Search upward for package.json
  let currentDir = workspaceDir;
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  
  console.log('Checking for Playwright starting from:', workspaceDir);
  
  while (currentDir && (!workspaceFolder || currentDir.startsWith(workspaceFolder))) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    
    console.log('Checking:', packageJsonPath);
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };
        
        console.log('Found package.json with deps:', Object.keys(deps));
        
        if ('@playwright/test' in deps || 'playwright' in deps) {
          console.log('Playwright found!');
          return true;
        }
      } catch (err) {
        console.log('Error reading package.json:', err);
        // Continue searching
      }
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }
  
  console.log('Playwright not found');
  return false;
}

/**
 * Helper: Prompt to install Playwright
 */
async function promptInstallPlaywright(workspaceDir: string): Promise<boolean> {
  const result = await vscode.window.showWarningMessage(
    'Playwright is not installed in this workspace.',
    'Install @playwright/test',
    'Cancel'
  );

  if (result !== 'Install @playwright/test') {
    return false;
  }

  const terminal = vscode.window.createTerminal({
    name: 'Install Playwright',
    cwd: workspaceDir
  });

  terminal.show();
  terminal.sendText('npm install -D @playwright/test');
  
  vscode.window.showInformationMessage(
    'Installing Playwright... Please wait for the installation to complete before running tests.'
  );

  return false; // Don't continue with test run
}

/**
 * Helper: Build HttpRecorder plugin
 */
async function buildHttpRecorderPlugin(workspaceFolder: string): Promise<void> {
  const pluginPath = path.join(
    workspaceFolder,
    'DevProxyExtension',
    'HttpRecorder.DevProxy',
    'HttpRecorder.DevProxy.csproj'
  );

  if (!fs.existsSync(pluginPath)) {
    throw new Error('HttpRecorder.DevProxy project not found');
  }

  const outputChannel = vscode.window.createOutputChannel('Plugin Build');
  outputChannel.appendLine('Building HttpRecorder.DevProxy plugin...');

  const { stdout, stderr } = await execFileAsync('dotnet', [
    'build',
    pluginPath,
    '--configuration', 'Debug'
  ]);

  outputChannel.appendLine(stdout);
  if (stderr) {
    outputChannel.appendLine(stderr);
  }
}

/**
 * Check if a port is currently in use
 */
async function isPortInUse(port: number, host: string = 'localhost'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port, host);
  });
}

/**
 * Helper: Get workspace folder
 */
function getWorkspaceFolder(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders?.[0]?.uri.fsPath;
}

/**
 * Helper: Get extension directory (handles both repo and standalone cases)
 */
function getExtensionDirectory(): string {
  // Use the extension context to get the actual extension installation path
  if (extensionContext) {
    return extensionContext.extensionPath;
  }

  // Fallback for development: check workspace
  const workspaceFolder = getWorkspaceFolder();
  if (!workspaceFolder) {
    throw new Error('No workspace folder found');
  }

  // Check if we're in the extension directory itself
  const packageJsonPath = path.join(workspaceFolder, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (packageJson.name === 'traffic-recorder') {
      // We're in the extension directory
      return workspaceFolder;
    }
  }

  // Check if we're in the HttpRecorder repo root
  const repoExtensionPath = path.join(workspaceFolder, 'extensions', 'traffic-recorder', 'package.json');
  if (fs.existsSync(repoExtensionPath)) {
    const packageJson = JSON.parse(fs.readFileSync(repoExtensionPath, 'utf-8'));
    if (packageJson.name === 'traffic-recorder') {
      // We're in the repo root
      return path.join(workspaceFolder, 'extensions', 'traffic-recorder');
    }
  }

  throw new Error('Could not locate traffic-recorder extension directory');
}

/**
 * Helper: Get startup script path
 */
/**
 * Helper: Kill process tree (cross-platform)
 */
function killProcessTree(pid: number) {
  if (process.platform === 'win32') {
    try {
      execFileAsync('taskkill', ['/pid', pid.toString(), '/T', '/F']);
    } catch (error) {
      console.error('Failed to kill process tree:', error);
    }
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch (error) {
      console.error('Failed to kill process tree:', error);
    }
  }
}

/**
 * Helper: Update status bar (referenced from activate)
 */
function updateStatusBar() {
  // This will be overridden in activate()
}
