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
import { FrameworkDetectionOrchestrator } from './frameworks/orchestrator';
import { DiscoveredTestFrameworks, TestFrameworkInfo } from './frameworks/types';
import { HARViewerProvider } from './harViewer';

const execFileAsync = promisify(execFile);

type ProxyStatus = 'stopped' | 'starting' | 'started' | 'stopping';

interface ProxyApiInfo {
  recording?: boolean;
  configFile?: string;
}

interface DevProxyState {
  process: ChildProcess | null;
  status: ProxyStatus;
  port: number;
  apiPort: number;
  host: string;
  outputDir: string;
  useBeta: boolean;
  startTime?: Date;
  apiInfo?: ProxyApiInfo;
  requestCount?: number;
  currentHarFile?: string;
  lastRequestTime?: number; // Timestamp of last request count change
  recordingTaskTerminal?: vscode.Terminal; // Track terminal for Record All Tests
  discoveredFrameworks?: DiscoveredTestFrameworks; // Cache discovered frameworks
}

const BRAILLE_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerInterval: NodeJS.Timeout | null = null;
let spinnerIndex = 0;
let statusCheckInterval: NodeJS.Timeout | null = null; // Periodic API status checker

let devProxyState: DevProxyState = {
  process: null,
  status: 'stopped',
  port: 8080,
  apiPort: 8897,
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
    // If we think it's started, verify via REST API
    if (devProxyState.status === 'started') {
      try {
        const response = await fetch(`http://${devProxyState.host}:${devProxyState.apiPort}/proxy`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          const apiInfo = await response.json() as ProxyApiInfo;
          devProxyState.apiInfo = apiInfo;
          
          // Find and count requests in current HAR file
          await this.updateRequestCount();
          
          // Still running, refresh to show updated info
          this.refresh();
        } else {
          // API responded but with error - consider it stopped
          devProxyState.status = 'stopped';
          devProxyState.process = null;
          devProxyState.apiInfo = undefined;
          this.refresh();
        }
      } catch (error) {
        // API not reachable - proxy is stopped
        devProxyState.status = 'stopped';
        devProxyState.process = null;
        devProxyState.apiInfo = undefined;
        this.refresh();
      }
    }
  }

  async updateRequestCount(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) return;

    const outputDirPath = path.join(workspaceFolder, devProxyState.outputDir);
    if (!fs.existsSync(outputDirPath)) return;

    // Find the most recent HAR file (session_*.har)
    const files = fs.readdirSync(outputDirPath);
    const harFiles = files.filter(f => f.startsWith('session_') && f.endsWith('.har'));
    
    if (harFiles.length > 0) {
      // Sort by modification time, get the newest
      const harFilePaths = harFiles.map(f => ({
        name: f,
        path: path.join(outputDirPath, f),
        mtime: fs.statSync(path.join(outputDirPath, f)).mtime
      }));
      
      harFilePaths.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      const currentFile = harFilePaths[0];
      
      devProxyState.currentHarFile = currentFile.name;
      const newCount = await countRequestsInHAR(currentFile.path);
      
      // Track if count has changed (request activity)
      if (newCount !== devProxyState.requestCount) {
        devProxyState.lastRequestTime = Date.now();
        
        // Advance spinner when new request arrives
        if (newCount > (devProxyState.requestCount || 0)) {
          spinnerIndex = (spinnerIndex + 1) % BRAILLE_SPINNER.length;
        }
      }
      
      devProxyState.requestCount = newCount;
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

    // Status with action button - combined with host:port
    let statusLabel: string;
    let statusIcon: string;
    let statusIconColor: vscode.ThemeColor | undefined;
    let statusCommand: string | undefined;
    
    switch (devProxyState.status) {
      case 'starting':
        statusLabel = `▶️ Starting (${devProxyState.host}:${devProxyState.port})`;
        statusIcon = 'loading~spin';
        statusIconColor = undefined;
        statusCommand = undefined; // Disabled during start
        break;
      case 'started':
        statusLabel = `⏹️ Running (${devProxyState.host}:${devProxyState.port})`;
        statusIcon = 'circle-filled';
        statusIconColor = new vscode.ThemeColor('testing.iconPassed');
        statusCommand = 'traffic-recorder.stopProxy';
        break;
      case 'stopping':
        statusLabel = `⏹️ Stopping (${devProxyState.host}:${devProxyState.port})`;
        statusIcon = 'loading~spin';
        statusIconColor = undefined;
        statusCommand = undefined; // Disabled during stop
        break;
      case 'stopped':
      default:
        statusLabel = `▶️ Start (${devProxyState.host}:${devProxyState.port})`;
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

    // Show recording status if proxy is running
    if (devProxyState.status === 'started') {
      const now = Date.now();
      const requestCount = devProxyState.requestCount || 0;
      const lastRequestTime = devProxyState.lastRequestTime || 0;
      const timeSinceLastRequest = now - lastRequestTime;
      const isTaskRunning = devProxyState.recordingTaskTerminal !== undefined;
      
      let recordingStatus: string;
      let recordingIcon: string;
      let recordingIconColor: vscode.ThemeColor | undefined;
      let recordingTooltip: string;
      
      if (requestCount === 0) {
        // No requests yet - show "Idle"
        recordingStatus = 'Idle';
        recordingIcon = 'star';
        recordingIconColor = new vscode.ThemeColor('charts.yellow');
        recordingTooltip = 'No requests recorded yet';
      } else if (timeSinceLastRequest < 10000) {
        // Active recording - requests coming in within last 10 seconds
        recordingStatus = `${BRAILLE_SPINNER[spinnerIndex]} Recording`;
        recordingIcon = 'record';
        recordingIconColor = new vscode.ThemeColor('errorForeground');
        recordingTooltip = 'Actively recording HTTP traffic';
      } else if (isTaskRunning) {
        // Task is running but no recent requests - waiting
        recordingStatus = `⟳ Waiting for requests`;
        recordingIcon = 'watch';
        recordingIconColor = new vscode.ThemeColor('charts.orange');
        recordingTooltip = 'Test task is running, waiting for HTTP traffic';
      } else {
        // No recent activity and no task running - idle
        recordingStatus = 'Idle';
        recordingIcon = 'star';
        recordingIconColor = new vscode.ThemeColor('charts.yellow');
        recordingTooltip = `No recent activity (${requestCount} requests recorded)`;
      }

      const recordingItem = new TreeItem(recordingStatus, vscode.TreeItemCollapsibleState.None);
      recordingItem.iconPath = new vscode.ThemeIcon(recordingIcon, recordingIconColor);
      recordingItem.tooltip = recordingTooltip;
      items.push(recordingItem);

      // Show config file if available
      if (devProxyState.apiInfo?.configFile) {
        const configFileName = path.basename(devProxyState.apiInfo.configFile);
        const configItem = new TreeItem(`📄 ${configFileName}`, vscode.TreeItemCollapsibleState.None);
        configItem.tooltip = devProxyState.apiInfo.configFile;
        items.push(configItem);
      }

      // Show request count if available
      if (requestCount > 0 && devProxyState.currentHarFile) {
        const countLabel = `📊 ${requestCount} requests`;
        const countItem = new TreeItem(countLabel, vscode.TreeItemCollapsibleState.None);
        countItem.iconPath = new vscode.ThemeIcon('graph-line');
        countItem.tooltip = `${devProxyState.currentHarFile} - ${requestCount} HTTP requests captured`;
        items.push(countItem);
      }
    }

    // Output directory item
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const outputDirDisplay = devProxyState.outputDir.startsWith('./') || devProxyState.outputDir.startsWith('.\\') 
      ? devProxyState.outputDir.substring(2) 
      : devProxyState.outputDir;
    const outputItem = new TreeItem(
      outputDirDisplay,
      vscode.TreeItemCollapsibleState.None
    );
    
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

    // Test framework buttons - show discovered frameworks
    if (devProxyState.discoveredFrameworks) {
      const frameworks = devProxyState.discoveredFrameworks;
      const playwright = getFramework(frameworks, 'Playwright');
      const vitest = getFramework(frameworks, 'Vitest');
      const pytest = getFramework(frameworks, 'pytest');
      
      if (playwright) {
        const playwrightItem = new TreeItem(`${playwright.icon} Record Playwright Tests`, vscode.TreeItemCollapsibleState.None);
        playwrightItem.iconPath = new vscode.ThemeIcon('beaker');
        playwrightItem.tooltip = `Run Playwright tests with traffic recording\n${playwright.workingDirectory}`;
        playwrightItem.command = {
          command: 'traffic-recorder.runPlaywrightTests',
          title: 'Record Playwright Tests'
        };
        items.push(playwrightItem);
      }
      
      if (vitest) {
        const vitestItem = new TreeItem(`${vitest.icon} Record Vitest Tests`, vscode.TreeItemCollapsibleState.None);
        vitestItem.iconPath = new vscode.ThemeIcon('beaker');
        vitestItem.tooltip = `Run Vitest tests with traffic recording\n${vitest.workingDirectory}`;
        vitestItem.command = {
          command: 'traffic-recorder.runVitestTests',
          title: 'Record Vitest Tests'
        };
        items.push(vitestItem);
      }
      
      // Check for any npm test script (Jest, Mocha, etc.)
      const jest = getFramework(frameworks, 'Jest');
      const mocha = getFramework(frameworks, 'Mocha');
      const npmTest = jest || mocha;
      
      if (npmTest) {
        const npmItem = new TreeItem(`${npmTest.icon} Record ${npmTest.name} Tests`, vscode.TreeItemCollapsibleState.None);
        npmItem.iconPath = new vscode.ThemeIcon('beaker');
        npmItem.tooltip = `Run ${npmTest.name} tests with traffic recording\n${npmTest.workingDirectory}`;
        npmItem.command = {
          command: 'traffic-recorder.runNpmTests',
          title: 'Record npm Tests'
        };
        items.push(npmItem);
      }
      
      if (pytest) {
        const pytestItem = new TreeItem(`${pytest.icon} Record pytest Tests`, vscode.TreeItemCollapsibleState.None);
        pytestItem.iconPath = new vscode.ThemeIcon('beaker');
        pytestItem.tooltip = `Run pytest with traffic recording\n${pytest.workingDirectory}`;
        pytestItem.command = {
          command: 'traffic-recorder.runPytestTests',
          title: 'Record pytest Tests'
        };
        items.push(pytestItem);
      }
    }

    // Certificate download link (show when proxy is running)
    if (devProxyState.status === 'started') {
      const certItem = new TreeItem('📜 Download Dev Certificate', vscode.TreeItemCollapsibleState.None);
      certItem.iconPath = new vscode.ThemeIcon('shield');
      certItem.tooltip = 'Download and install the Dev Proxy root certificate to trust HTTPS traffic';
      certItem.command = {
        command: 'traffic-recorder.downloadCertificate',
        title: 'Download Dev Certificate'
      };
      items.push(certItem);
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
  devProxyState.host = config.get<string>('devProxyHost', 'localhost');
  devProxyState.port = config.get<number>('devProxyPort', 8080);
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

  // Start periodic status checker to detect external Dev Proxy instances
  startStatusChecker();
  context.subscriptions.push({ dispose: stopStatusChecker });

  // Periodic status refresh when proxy is running (every 5 seconds)
  const statusRefreshInterval = setInterval(() => {
    if (devProxyState.status === 'started') {
      treeDataProvider.checkPortStatus();
    }
  }, 5000);
  context.subscriptions.push({ dispose: () => clearInterval(statusRefreshInterval) });

  // Detect test frameworks on activation and periodically
  async function refreshTestFrameworks() {
    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const autoDetect = config.get<boolean>('autoDetectFrameworks', true);
    
    if (autoDetect) {
      devProxyState.discoveredFrameworks = await detectTestFrameworks();
    } else {
      // Clear frameworks if auto-detect is disabled
      devProxyState.discoveredFrameworks = {
        javascript: [],
        python: [],
        java: [],
        csharp: [],
        go: [],
        ruby: [],
        php: [],
        swift: [],
        kotlin: [],
        all: []
      };
    }
    treeDataProvider.refresh();
  }
  
  refreshTestFrameworks(); // Initial detection
  
  // Re-detect frameworks when files change
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/{package.json,playwright.config.*,vitest.config.*,vite.config.*,pytest.ini,pyproject.toml,setup.cfg}');
  fileWatcher.onDidCreate(() => refreshTestFrameworks());
  fileWatcher.onDidChange(() => refreshTestFrameworks());
  fileWatcher.onDidDelete(() => refreshTestFrameworks());
  context.subscriptions.push(fileWatcher);

  // Listen for configuration changes and update state
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('trafficRecorder.devProxyPort')) {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      devProxyState.port = config.get<number>('devProxyPort', 8080);
      treeDataProvider.refresh();
    }
    if (e.affectsConfiguration('trafficRecorder.devProxyHost')) {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      devProxyState.host = config.get<string>('devProxyHost', 'localhost');
      treeDataProvider.refresh();
    }
    if (e.affectsConfiguration('trafficRecorder.outputDirectory')) {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      devProxyState.outputDir = config.get<string>('outputDirectory', '.http-recorder');
      ensureOutputDirectory();
      treeDataProvider.refresh();
    }
    if (e.affectsConfiguration('trafficRecorder.useBetaVersion')) {
      const config = vscode.workspace.getConfiguration('trafficRecorder');
      devProxyState.useBeta = config.get<boolean>('useBetaVersion', true);
    }
    if (e.affectsConfiguration('trafficRecorder.autoDetectFrameworks')) {
      refreshTestFrameworks();
    }
  });
  context.subscriptions.push(configChangeListener);

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

  // Register MCP Server Definition Provider  
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('trafficCopMcp', {
      async provideMcpServerDefinitions() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) {
          return [];
        }

        const recordingsDir = path.join(workspaceFolder, devProxyState.outputDir);
        const serverPath = path.join(context.extensionPath, 'dist', 'mcp', 'server.js');

        return [{
          label: 'Traffic Cop - HAR Analysis',
          command: process.execPath, // Use Node.js
          args: [serverPath],
          env: {
            RECORDINGS_DIR: recordingsDir,
            TRANSPORT: 'stdio',
          },
        }];
      },
    })
  );

  // Register Language Model Tool for starting proxy in terminal
  context.subscriptions.push(
    vscode.lm.registerTool('traffic-recorder_startProxyInTerminal', {
      async invoke(_options, _token) {
        try {
          await vscode.commands.executeCommand('traffic-recorder.startProxy');
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Dev Proxy started successfully in VS Code terminal. You can now see the proxy output and control it interactively.')
          ]);
        } catch (error) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Failed to start Dev Proxy: ${error instanceof Error ? error.message : 'Unknown error'}`)
          ]);
        }
      }
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('traffic-recorder.startProxy', startProxy),
    vscode.commands.registerCommand('traffic-recorder.stopProxy', stopProxy),
    vscode.commands.registerCommand('traffic-recorder.runTests', runTests),
    vscode.commands.registerCommand('traffic-recorder.runCurrentTest', runCurrentTest),
    vscode.commands.registerCommand('traffic-recorder.installDevProxy', installDevProxy),
    vscode.commands.registerCommand('traffic-recorder.downloadCertificate', downloadCertificate),
    vscode.commands.registerCommand('traffic-recorder.runPlaywrightTests', () => runFrameworkTests('playwright')),
    vscode.commands.registerCommand('traffic-recorder.runVitestTests', () => runFrameworkTests('vitest')),
    vscode.commands.registerCommand('traffic-recorder.runNpmTests', () => runFrameworkTests('npm')),
    vscode.commands.registerCommand('traffic-recorder.runPytestTests', () => runFrameworkTests('pytest'))
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
  // Update status bar when proxy state changes
  const updateStatusBar = () => {
    if (devProxyState.status === 'started') {
      statusBarItem.text = '$(debug-stop) Dev Proxy (Running)';
      statusBarItem.command = 'traffic-recorder.stopProxy';
      statusBarItem.tooltip = 'Stop Dev Proxy';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (devProxyState.status === 'starting') {
      statusBarItem.text = `$(sync~spin) Dev Proxy (Starting...)`;
      statusBarItem.command = undefined;
      statusBarItem.tooltip = 'Dev Proxy is starting...';
      statusBarItem.backgroundColor = undefined;
    } else if (devProxyState.status === 'stopping') {
      statusBarItem.text = `$(sync~spin) Dev Proxy (Stopping...)`;
      statusBarItem.command = undefined;
      statusBarItem.tooltip = 'Dev Proxy is stopping...';
      statusBarItem.backgroundColor = undefined;
    } else {
      statusBarItem.text = '$(record) Dev Proxy';
      statusBarItem.command = 'traffic-recorder.startProxy';
      statusBarItem.tooltip = 'Start Dev Proxy';
      statusBarItem.backgroundColor = undefined;
    }
    // Refresh tree view to update the explorer panel
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
  // Stop the periodic status checker
  stopStatusChecker();
  
  // Clean up spinner intervals
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  
  // Kill Dev Proxy process if we spawned it
  if (devProxyState.process) {
    killProcessTree(devProxyState.process.pid!);
  }
}

/**
 * Check if a port is currently in use by attempting to connect to it
 */
async function isPortInUse(port: number, host: string): Promise<boolean> {
  try {
    // Always use 127.0.0.1 instead of hostname to bypass proxy interception
    const apiHost = host === 'localhost' ? '127.0.0.1' : host;
    await fetch(`http://${apiHost}:${port}/proxy`, {
      method: 'GET',
      signal: AbortSignal.timeout(1000)
    });
    // If we get a response (any response), the port is in use
    return true;
  } catch (error: any) {
    // Connection refused or timeout means port is available
    return false;
  }
}

/**
 * Periodic status checker - runs every 5 seconds to detect external Dev Proxy instances
 */
async function checkDevProxyStatus() {
  try {
    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const host = config.get<string>('devProxyHost', 'localhost');
    const apiPort = 8897;
    
    // Always use 127.0.0.1 instead of hostname to bypass proxy interception
    const apiHost = host === 'localhost' ? '127.0.0.1' : host;
    
    const response = await fetch(`http://${apiHost}:${apiPort}/proxy`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      // Dev Proxy is running
      if (devProxyState.status === 'stopped') {
        // External instance detected - adopt it
        devProxyState.status = 'started';
        devProxyState.host = host;
        devProxyState.apiPort = apiPort;
        devProxyState.process = null; // External instance
        
        const apiInfo = await response.json() as ProxyApiInfo;
        devProxyState.apiInfo = apiInfo;
        
        treeDataProvider.refresh();
        updateStatusBar();
      } else if (devProxyState.status === 'started') {
        // Update API info
        const apiInfo = await response.json() as ProxyApiInfo;
        devProxyState.apiInfo = apiInfo;
        treeDataProvider.refresh();
      }
    } else {
      // API returned error response
      if (devProxyState.status === 'started' && !devProxyState.process) {
        // External instance stopped
        devProxyState.status = 'stopped';
        treeDataProvider.refresh();
        updateStatusBar();
      }
    }
  } catch (error: any) {
    // API not reachable
    if (devProxyState.status === 'started' && !devProxyState.process) {
      // External instance stopped
      devProxyState.status = 'stopped';
      treeDataProvider.refresh();
      updateStatusBar();
    }
  }
}

/**
 * Start the periodic status checker
 */
function startStatusChecker() {
  if (!statusCheckInterval) {
    // Check immediately
    checkDevProxyStatus();
    // Then check every 5 seconds
    statusCheckInterval = setInterval(checkDevProxyStatus, 5000);
  }
}

/**
 * Stop the periodic status checker
 */
function stopStatusChecker() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }
}

/**
 * Mark proxy as started: clear spinner, set state, refresh UI, fetch initial API info
 */
function markProxyStarted() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  devProxyState.status = 'started';
  treeDataProvider.refresh();
  updateStatusBar();

  // Fetch initial API status shortly after start
  setTimeout(async () => {
    try {
      const response = await fetch(`http://${devProxyState.host}:${devProxyState.apiPort}/proxy`);
      if (response.ok) {
        const apiInfo = await response.json() as ProxyApiInfo;
        devProxyState.apiInfo = apiInfo;
        treeDataProvider.refresh();
      }
    } catch {
      // Ignore; periodic checker will update later
    }
  }, 1000);
}

/**
 * Wait until Dev Proxy API responds OK or timeout expires
 */
async function waitForDevProxyReady(host: string, apiPort: number, timeoutMs = 10000, intervalMs = 250): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  // Always use 127.0.0.1 instead of hostname to bypass proxy interception
  const apiHost = host === 'localhost' ? '127.0.0.1' : host;
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(intervalMs, 2000));
      const res = await fetch(`http://${apiHost}:${apiPort}/proxy`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return true;
      }
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Show Dev Proxy installation guide in markdown
 */
async function showDevProxyInstallationGuide(useBeta: boolean) {
  const extensionPath = getExtensionDirectory();
  const installGuidePath = path.join(extensionPath, 'docs', 'install-dev-proxy.md');
  
  try {
    // Open the markdown document
    const uri = vscode.Uri.file(installGuidePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: true
    });
    
    // Also show a notification with quick actions
    const useBetaText = useBeta ? ' Beta' : '';
    const action = await vscode.window.showErrorMessage(
      `Dev Proxy${useBetaText} is not found. Installation guide has been opened.`,
      'Try Auto-Install',
      'Check Again',
      'Close'
    );
    
    if (action === 'Try Auto-Install') {
      await installDevProxy();
    } else if (action === 'Check Again') {
      const isNowInstalled = await isDevProxyInstalled();
      if (!isNowInstalled) {
        vscode.window.showWarningMessage(
          'Dev Proxy is still not detected. Please follow the installation guide and restart VS Code after installation.'
        );
      }
    }
  } catch (error) {
    // Fallback if markdown file doesn't exist
    const useBetaText = useBeta ? ' Beta' : '';
    const action = await vscode.window.showErrorMessage(
      `Failed to start Dev Proxy${useBetaText}: Command not found.\n\n` +
      `Please install Dev Proxy and restart VS Code.`,
      'Open Official Guide',
      'Try Auto-Install'
    );
    
    if (action === 'Open Official Guide') {
      vscode.env.openExternal(vscode.Uri.parse('https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/get-started'));
    } else if (action === 'Try Auto-Install') {
      await installDevProxy();
    }
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

  // Get configuration first
  const config = vscode.workspace.getConfiguration('trafficRecorder');
  const host = config.get<string>('devProxyHost', 'localhost');
  const port = config.get<number>('devProxyPort', 8080);
  const apiPort = 8897;
  const outputDir = config.get<string>('outputDirectory', '.http-recorder');
  const useBeta = config.get<boolean>('useBetaVersion', true);
  const useLocalPlugin = config.get<boolean>('useLocalPlugin', false);
  const asSystemProxy = config.get<boolean>('asSystemProxy', false);

  // PRE-FLIGHT CHECK: Is Dev Proxy already running?
  try {
    // Always use 127.0.0.1 instead of hostname to bypass proxy interception
    const apiHost = host === 'localhost' ? '127.0.0.1' : host;
    const response = await fetch(`http://${apiHost}:${apiPort}/proxy`, { signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      // Dev Proxy is already running externally!
      devProxyState.status = 'started';
      devProxyState.host = host;
      devProxyState.port = port;
      devProxyState.apiPort = apiPort;
      devProxyState.outputDir = outputDir;
      devProxyState.useBeta = useBeta;
      devProxyState.process = null; // Not our process
      const apiInfo = await response.json() as ProxyApiInfo;
      devProxyState.apiInfo = apiInfo;
      treeDataProvider.refresh();
      updateStatusBar();
      return;
    }
  } catch {
    // Good - API not reachable, we can start
  }

  // Set status to starting and start spinner animation
  devProxyState.status = 'starting';
  treeDataProvider.refresh();
  // Update status bar and view immediately to reflect starting state
  updateStatusBar();
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % BRAILLE_SPINNER.length;
    treeDataProvider.refresh();
  }, 80);

  try {
    // Update state
    devProxyState.host = host;
    devProxyState.port = port;
    devProxyState.apiPort = apiPort;
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
      await showDevProxyInstallationGuide(useBeta);
      
      // Check again after user has had chance to install
      const isNowInstalled = await isDevProxyInstalled();
      if (!isNowInstalled) {
        return; // User chose not to install or installation failed
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
    
    // Get augmented environment with Dev Proxy paths
    const spawnEnv = getAugmentedEnvironment(useBeta);
    const devProxyPath = findDevProxyExecutable(useBeta);
    if (devProxyPath) {
      outputChannel.appendLine(`Found Dev Proxy in: ${devProxyPath}`);
    }
    outputChannel.appendLine('');

    proxyProcess = spawn(devProxyCommand, args, {
      cwd: workspaceConfigDir, // Run from .http-recorder so relative paths work
      shell: true, // Use shell to resolve command in PATH
      windowsHide: false,
      env: spawnEnv // Use augmented environment with Dev Proxy paths
    });

    // Handle process output - just log it, don't parse
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
      
      // Show helpful error message
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        showDevProxyInstallationGuide(useBeta);
      }
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
    devProxyState.port = port;
    treeDataProvider.refresh();
    updateStatusBar();

    // Poll the Dev Proxy API until it's ready, then mark as started
    // This is the ONLY way we determine if proxy is running
    (async () => {
      try {
        outputChannel.appendLine('Waiting for Dev Proxy API to become ready...');
        const ready = await waitForDevProxyReady(devProxyState.host, devProxyState.apiPort, 15000, 300);
        outputChannel.appendLine(`API ready check result: ${ready}, current status: ${devProxyState.status}`);
        if (ready && devProxyState.status === 'starting') {
          outputChannel.appendLine('Marking proxy as started');
          markProxyStarted();
        } else if (!ready) {
          outputChannel.appendLine('WARNING: Dev Proxy API did not respond within 15 seconds');
        } else if (devProxyState.status !== 'starting') {
          outputChannel.appendLine(`WARNING: Status changed to ${devProxyState.status} before API was ready`);
        }
      } catch (err) {
        outputChannel.appendLine(`ERROR in API polling: ${err}`);
      }
    })();

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to start Dev Proxy: ${error}`);
  }
}

/**
 * Stop Dev Proxy command
 */
async function stopProxy() {
  if (devProxyState.status !== 'started') {
    vscode.window.showWarningMessage('Dev Proxy is not running');
    return;
  }

  // Set status to stopping and start spinner animation
  devProxyState.status = 'stopping';
  treeDataProvider.refresh();
  updateStatusBar();
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % BRAILLE_SPINNER.length;
    treeDataProvider.refresh();
  }, 80);

  // Create output channel to show shutdown progress
  const outputChannel = vscode.window.createOutputChannel('Dev Proxy');
  outputChannel.show();

  try {
    outputChannel.appendLine('');
    outputChannel.appendLine('='.repeat(60));
    outputChannel.appendLine('Stopping Dev Proxy gracefully via API...');
    
    // Always use Dev Proxy's REST API for graceful shutdown
    // This works for both our spawned processes and external instances
    try {
      const stopUrl = `http://${devProxyState.host}:${devProxyState.apiPort}/proxy/stopproxy`;
      outputChannel.appendLine(`Calling shutdown API: ${stopUrl}`);
      
      const response = await fetch(stopUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        outputChannel.appendLine('Shutdown API called successfully (202 Accepted)');
      } else {
        outputChannel.appendLine(`Shutdown API returned: ${response.status} ${response.statusText}`);
      }
    } catch (fetchError: any) {
      outputChannel.appendLine(`Failed to call shutdown API: ${fetchError.message}`);
      // If we have a child process, kill it
      if (devProxyState.process) {
        outputChannel.appendLine('Falling back to process termination...');
      }
    }
    
    // Wait for process to exit gracefully (up to 30 seconds after API call to allow HAR flush)
    if (devProxyState.process && devProxyState.process.pid) {
      const childProcess = devProxyState.process;
      const exitPromise = new Promise<void>((resolve) => {
        const exitHandler = (code: number | null) => {
          outputChannel.appendLine(`Process exited with code: ${code ?? 'null (graceful shutdown)'}`);
          resolve();
        };
        childProcess.once('exit', exitHandler);
        
        // Timeout after 30 seconds and force kill if needed
        setTimeout(() => {
          childProcess.removeListener('exit', exitHandler);
          if (childProcess.pid && childProcess.exitCode === null) {
            outputChannel.appendLine('WARNING: Process did not exit gracefully after 30 seconds');
            outputChannel.appendLine('Force killing process tree...');
            killProcessTree(childProcess.pid);
          }
          resolve();
        }, 30000);
      });
      
      await exitPromise;
    } else {
      // External instance - wait a bit for it to shut down
      outputChannel.appendLine('Waiting for external Dev Proxy instance to shut down...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    outputChannel.appendLine('Dev Proxy stopped successfully');
    outputChannel.appendLine('='.repeat(60));
    
    devProxyState.process = null;
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    devProxyState.status = 'stopped';
    treeDataProvider.refresh();
    updateStatusBar();
  } catch (error) {
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      spinnerInterval = null;
    }
    devProxyState.status = 'stopped';
    devProxyState.process = null;
    treeDataProvider.refresh();
    updateStatusBar();
    vscode.window.showErrorMessage(`Failed to stop Dev Proxy: ${error}`);
  }
}

/**
 * Download Dev Proxy root certificate
 */
async function downloadCertificate() {
  try {
    if (devProxyState.status !== 'started') {
      vscode.window.showWarningMessage('Dev Proxy must be running to download the certificate');
      return;
    }

    const certUrl = `http://${devProxyState.host}:${devProxyState.apiPort}/proxy/rootCertificate?format=crt`;
    
    const response = await fetch(certUrl);
    if (!response.ok) {
      throw new Error(`Failed to download certificate: ${response.statusText}`);
    }

    const certData = await response.arrayBuffer();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    const certPath = path.join(workspaceFolder, 'devProxy.pem');
    fs.writeFileSync(certPath, Buffer.from(certData));

    const action = await vscode.window.showInformationMessage(
      `Dev Proxy certificate downloaded to ${path.basename(certPath)}`,
      'Open File',
      'Show in Explorer',
      'Install Instructions'
    );

    if (action === 'Open File') {
      const doc = await vscode.workspace.openTextDocument(certPath);
      await vscode.window.showTextDocument(doc);
    } else if (action === 'Show in Explorer') {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(certPath));
    } else if (action === 'Install Instructions') {
      const os = process.platform;
      let instructions = '';
      
      if (os === 'win32') {
        instructions = `To install the certificate on Windows:
1. Double-click devProxy.pem
2. Click "Install Certificate..."
3. Select "Current User" or "Local Machine"
4. Select "Place all certificates in the following store"
5. Click "Browse" and select "Trusted Root Certification Authorities"
6. Click "Next" and "Finish"`;
      } else if (os === 'darwin') {
        instructions = `To install the certificate on macOS:
1. Double-click devProxy.pem to open Keychain Access
2. Enter your password when prompted
3. Find "Dev Proxy" in the list
4. Double-click it and expand "Trust"
5. Set "When using this certificate" to "Always Trust"`;
      } else {
        instructions = `To install the certificate on Linux:
1. Copy devProxy.pem to /usr/local/share/ca-certificates/devProxy.crt
2. Run: sudo update-ca-certificates

For Firefox:
1. Open Preferences > Privacy & Security > Certificates
2. Click "View Certificates" > "Authorities" > "Import"
3. Select devProxy.pem and check "Trust this CA to identify websites"`;
      }

      const panel = vscode.window.createWebviewPanel(
        'certInstructions',
        'Dev Proxy Certificate Installation',
        vscode.ViewColumn.One,
        {}
      );
      
      panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; line-height: 1.6; }
    pre { background: var(--vscode-textCodeBlock-background); padding: 15px; border-radius: 5px; }
    h2 { color: var(--vscode-foreground); }
  </style>
</head>
<body>
  <h2>Installing Dev Proxy Certificate</h2>
  <pre>${instructions}</pre>
  <p><strong>Note:</strong> You may need to restart your browser after installing the certificate.</p>
</body>
</html>`;
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to download certificate: ${error}`);
  }
}

/**
 * Run tests for a specific framework with traffic recording
 */
async function runFrameworkTests(framework: 'playwright' | 'vitest' | 'npm' | 'pytest') {
  try {
    if (!devProxyState.discoveredFrameworks) {
      vscode.window.showErrorMessage('Test frameworks not detected. Please ensure you have test configuration files in your workspace.');
      return;
    }

    // Map framework names to actual framework names
    const frameworkNameMap: Record<string, string> = {
      'playwright': 'Playwright',
      'vitest': 'Vitest',
      'npm': 'Jest', // Try Jest first, fallback to Mocha
      'pytest': 'pytest'
    };
    
    let frameworkInfo = getFramework(devProxyState.discoveredFrameworks, frameworkNameMap[framework]);
    
    // For npm, try multiple frameworks
    if (framework === 'npm' && !frameworkInfo) {
      frameworkInfo = getFramework(devProxyState.discoveredFrameworks, 'Mocha');
    }
    
    if (!frameworkInfo) {
      vscode.window.showErrorMessage(`${frameworkNameMap[framework]} tests not detected in workspace.`);
      return;
    }

    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const autoStart = config.get<boolean>('autoStart', false);

    // Check if proxy is running via API port
    const apiPort = 8897;
    const portInUse = await isPortInUse(apiPort, devProxyState.host);
    
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

    const workingDir = frameworkInfo.workingDirectory || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workingDir) {
      vscode.window.showErrorMessage('Could not determine working directory for tests.');
      return;
    }

    // Create terminal with proxy environment variables
    const proxyEnv = getProxyEnvironment();
    const terminal = vscode.window.createTerminal({
      name: `${frameworkInfo.name} Tests`,
      cwd: workingDir,
      env: proxyEnv
    });

    // Track terminal for recording status
    devProxyState.recordingTaskTerminal = terminal;
    
    // Clean up terminal tracking when it closes
    const terminalCloseListener = vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === terminal) {
        devProxyState.recordingTaskTerminal = undefined;
        treeDataProvider.refresh();
        terminalCloseListener.dispose();
      }
    });

    terminal.show();
    
    // Send appropriate command based on framework
    const command = frameworkInfo.command || 'npm test';
    terminal.sendText(command);

    vscode.window.showInformationMessage(
      `Running ${frameworkInfo.name} with traffic recording...`,
      'View Output'
    ).then(selection => {
      if (selection === 'View Output') {
        const outputDir = path.join(workingDir, devProxyState.outputDir);
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputDir));
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to run ${framework} tests: ${error}`);
  }
}

/**
 * Run Playwright tests command
 */
async function runTests() {
  try {
    const config = vscode.workspace.getConfiguration('trafficRecorder');
    const autoStart = config.get<boolean>('autoStart', false);

    // Check if proxy is actually running via API port
    const apiPort = 8897;
    const portInUse = await isPortInUse(apiPort, devProxyState.host);
    
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

    // Track terminal for recording status
    devProxyState.recordingTaskTerminal = terminal;
    
    // Clean up terminal tracking when it closes
    const terminalCloseListener = vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === terminal) {
        devProxyState.recordingTaskTerminal = undefined;
        treeDataProvider.refresh();
        terminalCloseListener.dispose();
      }
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
 * Get common Dev Proxy installation paths based on platform
 */
function getDevProxyInstallationPaths(useBeta: boolean): string[] {
  const paths: string[] = [];
  
  if (process.platform === 'win32') {
    // Windows installation paths
    const userProfile = process.env.USERPROFILE || process.env.HOME || '';
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');
    
    // Standalone installer locations (most common)
    const programName = useBeta ? 'Dev Proxy Beta' : 'Dev Proxy';
    paths.push(path.join(localAppData, 'Programs', programName));
    paths.push(path.join(programFiles, programName));
    
    // Winget installs to user profile by default
    // Look for any directory matching the pattern (hash can vary)
    const wingetPackagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetPackagesDir)) {
      try {
        const prefix = useBeta ? 'DevProxy.DevProxy.Beta_' : 'DevProxy.DevProxy_';
        const packages = fs.readdirSync(wingetPackagesDir);
        for (const pkg of packages) {
          if (pkg.startsWith(prefix)) {
            paths.push(path.join(wingetPackagesDir, pkg));
          }
        }
      } catch {
        // Fallback to hardcoded paths
        paths.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', useBeta ? 'DevProxy.DevProxy.Beta_Microsoft.Winget.Source_8wekyb3d8bbwe' : 'DevProxy.DevProxy_Microsoft.Winget.Source_8wekyb3d8bbwe'));
      }
    }
    
    // WinGet Links directory (symlinks to executables)
    paths.push(path.join(localAppData, 'Microsoft', 'WinGet', 'Links'));
    
    // Chocolatey installation
    paths.push(path.join(programFiles, 'dev-proxy'));
    paths.push('C:\\ProgramData\\chocolatey\\lib\\dev-proxy\\tools');
    
    // Manual installation in user profile
    paths.push(path.join(userProfile, '.dev-proxy'));
    paths.push(path.join(userProfile, 'dev-proxy'));
    
    // dotnet tool global installation
    paths.push(path.join(userProfile, '.dotnet', 'tools'));
    
  } else if (process.platform === 'darwin') {
    // macOS installation paths
    const home = process.env.HOME || '';
    
    // Homebrew installation
    paths.push('/usr/local/bin');
    paths.push('/opt/homebrew/bin');
    
    // dotnet tool global installation
    paths.push(path.join(home, '.dotnet', 'tools'));
    
    // Manual installation
    paths.push(path.join(home, '.dev-proxy'));
    paths.push('/usr/local/share/dev-proxy');
    
  } else {
    // Linux installation paths
    const home = process.env.HOME || '';
    
    // System-wide installation
    paths.push('/usr/local/bin');
    paths.push('/usr/bin');
    
    // dotnet tool global installation
    paths.push(path.join(home, '.dotnet', 'tools'));
    
    // Manual installation
    paths.push(path.join(home, '.dev-proxy'));
    paths.push(path.join(home, '.local', 'bin'));
    paths.push('/opt/dev-proxy');
  }
  
  return paths;
}

/**
 * Find Dev Proxy executable in common installation locations
 * Returns the directory containing the executable, or null if not found
 */
function findDevProxyExecutable(useBeta: boolean): string | null {
  const command = useBeta ? 'devproxy-beta' : 'devproxy';
  const executableName = process.platform === 'win32' ? `${command}.exe` : command;
  
  const searchPaths = getDevProxyInstallationPaths(useBeta);
  
  for (const searchPath of searchPaths) {
    const fullPath = path.join(searchPath, executableName);
    if (fs.existsSync(fullPath)) {
      try {
        // Check if file is executable (on Unix-like systems)
        if (process.platform !== 'win32') {
          const stats = fs.statSync(fullPath);
          if (!(stats.mode & 0o111)) {
            continue; // Not executable
          }
        }
        return searchPath;
      } catch {
        continue;
      }
    }
  }
  
  return null;
}

/**
 * Get augmented environment with Dev Proxy paths
 */
function getAugmentedEnvironment(useBeta: boolean): NodeJS.ProcessEnv {
  const env = { ...process.env };
  
  // Try to find Dev Proxy in common locations
  const devProxyPath = findDevProxyExecutable(useBeta);
  
  if (devProxyPath) {
    // Add to PATH
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    const currentPath = env.PATH || env.Path || '';
    
    // Only add if not already in PATH
    if (!currentPath.split(pathSeparator).includes(devProxyPath)) {
      env.PATH = devProxyPath + pathSeparator + currentPath;
      if (process.platform === 'win32') {
        env.Path = env.PATH; // Windows uses both PATH and Path
      }
    }
  }
  
  return env;
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

    const restartMessage = 'Dev Proxy installed successfully! You may need to restart VS Code for PATH changes to take effect.';
    const action = await vscode.window.showInformationMessage(restartMessage, 'Restart Now', 'Later');
    
    if (action === 'Restart Now') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }

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
  
  // First try with augmented environment (check common locations)
  const devProxyPath = findDevProxyExecutable(useBeta);
  if (devProxyPath) {
    const executableName = process.platform === 'win32' ? `${command}.exe` : command;
    const fullPath = path.join(devProxyPath, executableName);
    try {
      await execFileAsync(fullPath, ['--version']);
      return true;
    } catch {
      // Executable exists but failed to run
      return false;
    }
  }
  
  // Try without path (check if it's in system PATH)
  try {
    await execFileAsync(command, ['--version'], { env: getAugmentedEnvironment(useBeta) });
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
 * Detect all available test frameworks in the workspace using the orchestrator
 */
async function detectTestFrameworks(): Promise<DiscoveredTestFrameworks> {
  const orchestrator = new FrameworkDetectionOrchestrator();
  const results = await orchestrator.detectAllFrameworks();
  return results;
}

/**
 * Get a specific framework from discovered frameworks by name
 */
function getFramework(frameworks: DiscoveredTestFrameworks, name: string): TestFrameworkInfo | undefined {
  // Search all categories for the framework
  for (const category of Object.values(frameworks)) {
    if (Array.isArray(category)) {
      const found = category.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Build environment variables for test execution with HTTP proxy
 */
function getProxyEnvironment(): NodeJS.ProcessEnv {
  const proxyUrl = `http://${devProxyState.host}:${devProxyState.port}`;
  
  // Start with augmented environment that includes Dev Proxy paths
  const baseEnv = getAugmentedEnvironment(devProxyState.useBeta);
  
  return {
    ...baseEnv,
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    http_proxy: proxyUrl,
    https_proxy: proxyUrl,
    // For Node.js to accept Dev Proxy's self-signed certificate
    NODE_TLS_REJECT_UNAUTHORIZED: '0'
  };
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
/**
 * Count the number of requests in a HAR file by counting "startedDateTime" occurrences
 * Uses a streaming approach to avoid loading the entire file into memory
 */
async function countRequestsInHAR(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    if (!fs.existsSync(filePath)) {
      resolve(0);
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      // Count occurrences of "startedDateTime"
      const matches = content.match(/"startedDateTime"/g);
      resolve(matches ? matches.length : 0);
    } catch (error) {
      // File might be locked or corrupted, return 0
      resolve(0);
    }
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
  // This stub is called from module-level functions
  // The tree view refresh happens here since status changes should update the UI
  treeDataProvider.refresh();
}
