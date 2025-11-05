import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Provider for HAR file viewing in a WebView panel
 */
export class HARViewerProvider {
    public static readonly viewType = 'trafficRecorder.harViewer';

    private static _panels = new Map<string, vscode.WebviewPanel>();

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public static register(context: vscode.ExtensionContext): vscode.Disposable[] {
        const provider = new HARViewerProvider(context.extensionUri);

        const previewCommand = vscode.commands.registerCommand('trafficRecorder.previewHAR', (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (fileUri) {
                provider.openHARFile(fileUri);
            } else {
                vscode.window.showErrorMessage('No HAR file selected');
            }
        });

        // Register text document content provider for .har files
        const openHARCommand = vscode.workspace.onDidOpenTextDocument(doc => {
            if (doc.fileName.endsWith('.har') && doc.languageId === 'json') {
                // Don't auto-open, just make the command available
            }
        });

        return [previewCommand, openHARCommand];
    }

    public async openHARFile(uri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        const fileName = path.basename(uri.fsPath);
        const panelKey = uri.fsPath;

        // If we already have a panel for this file, check if it's still valid
        let panel = HARViewerProvider._panels.get(panelKey);
        if (panel) {
            try {
                panel.reveal(column);
                // If panel is still valid, reload the content
                const fileContent = await vscode.workspace.fs.readFile(uri);
                let harContent = Buffer.from(fileContent).toString('utf8');
                
                // Remove BOM if present
                if (harContent.charCodeAt(0) === 0xFEFF) {
                    harContent = harContent.substring(1);
                }
                
                JSON.parse(harContent); // Validate
                panel.webview.postMessage({
                    type: 'harData',
                    data: harContent
                });
                return;
            } catch (error) {
                // Panel was disposed or file read failed, remove it and create new one
                HARViewerProvider._panels.delete(panelKey);
            }
        }

        // Create a new panel
        panel = vscode.window.createWebviewPanel(
            HARViewerProvider.viewType,
            `HAR: ${fileName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'dist', 'har-viewer'),
                ]
            }
        );

        HARViewerProvider._panels.set(panelKey, panel);

        // Load HAR file content
        let harContent: string;
        try {
            const fileContent = await vscode.workspace.fs.readFile(uri);
            harContent = Buffer.from(fileContent).toString('utf8');
            
            // Remove BOM if present
            if (harContent.charCodeAt(0) === 0xFEFF) {
                harContent = harContent.substring(1);
            }
            
            // Validate it's valid JSON
            JSON.parse(harContent);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load HAR file: ${error}`);
            panel.dispose();
            return;
        }

        // Set HTML content
        panel.webview.html = this._getHtmlForWebview(panel.webview);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'ready':
                        // Send HAR data when webview is ready
                        panel!.webview.postMessage({
                            type: 'harData',
                            data: harContent
                        });
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.message);
                        break;
                }
            }
        );

        // Clean up when panel is closed
        panel.onDidDispose(() => {
            HARViewerProvider._panels.delete(panelKey);
        }, null);

        // Update panel when file changes
        const fileWatcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);
        fileWatcher.onDidChange(async () => {
            try {
                const fileContent = await vscode.workspace.fs.readFile(uri);
                let newContent = Buffer.from(fileContent).toString('utf8');
                
                // Remove BOM if present
                if (newContent.charCodeAt(0) === 0xFEFF) {
                    newContent = newContent.substring(1);
                }
                
                JSON.parse(newContent); // Validate
                
                panel!.webview.postMessage({
                    type: 'harData',
                    data: newContent
                });
            } catch (error) {
                console.error('Failed to reload HAR file:', error);
            }
        });

        panel.onDidDispose(() => {
            fileWatcher.dispose();
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get paths to bundled viewer files
        const harViewerPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'har-viewer');
        
        // Get URIs for assets
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(harViewerPath, 'assets', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(harViewerPath, 'assets', 'main.css'));

        // Use a nonce to allow specific scripts to run
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>HAR Viewer</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        .vscode-dark {
            --vscode-foreground: var(--vscode-editor-foreground);
            --vscode-editor-background: var(--vscode-editor-background);
        }
        .vscode-light {
            --vscode-foreground: var(--vscode-editor-foreground);
            --vscode-editor-background: var(--vscode-editor-background);
        }
        .vscode-high-contrast {
            --vscode-foreground: var(--vscode-editor-foreground);
            --vscode-editor-background: var(--vscode-editor-background);
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
