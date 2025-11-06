import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Attempts to fix a truncated HAR file by removing incomplete entries and adding missing closing braces
 */
function fixTruncatedHAR(harContent: string): { fixed: boolean; content: string; error?: string } {
    try {
        // First try to parse - if it works, no fix needed
        JSON.parse(harContent);
        return { fixed: false, content: harContent };
    } catch (error: any) {
        const errorMessage = error.message || String(error);
        
        // Try to find the last complete entry
        let fixedContent = harContent;
        
        // Fix common malformed JSON patterns first
        // Pattern: }, , , { (extra commas between entries)
        fixedContent = fixedContent.replace(/\},\s*,+\s*\{/g, '},\n{');
        
        // Pattern: extra trailing commas before closing bracket
        fixedContent = fixedContent.replace(/,(\s*\])/g, '$1');
        
        // Pattern: }] without proper wrapping
        fixedContent = fixedContent.replace(/\}\s*\]\s*$/g, '}\n]\n}\n}');
        
        // Try parsing the cleaned-up content
        try {
            JSON.parse(fixedContent);
            return {
                fixed: true,
                content: fixedContent,
                error: 'Auto-fixed: Removed malformed JSON syntax (extra commas)'
            };
        } catch (stillBroken) {
            // Continue with more aggressive fixes
        }
        
        // Look for the entries array
        const entriesMatch = harContent.match(/"entries"\s*:\s*\[/);
        if (entriesMatch && entriesMatch.index !== undefined) {
            const entriesStart = entriesMatch.index + entriesMatch[0].length;
            
            // Find all complete entry objects by looking for "startedDateTime" markers
            // Each entry starts with { and should end with }
            const beforeEntries = harContent.substring(0, entriesStart);
            const entriesContent = harContent.substring(entriesStart);
            
            // Find all startedDateTime positions (each marks a new entry)
            const entryStarts: number[] = [];
            let pos = 0;
            while ((pos = entriesContent.indexOf('"startedDateTime"', pos)) !== -1) {
                // Find the opening brace before this
                let bracePos = pos;
                let depth = 0;
                while (bracePos > 0) {
                    if (entriesContent[bracePos] === '}') depth++;
                    if (entriesContent[bracePos] === '{') {
                        if (depth === 0) break;
                        depth--;
                    }
                    bracePos--;
                }
                if (entriesContent[bracePos] === '{') {
                    entryStarts.push(bracePos);
                }
                pos++;
            }
            
            if (entryStarts.length > 0) {
                // Try to find the last complete entry
                // Start from the second-to-last entry and work backwards
                for (let i = entryStarts.length - 1; i >= Math.max(0, entryStarts.length - 5); i--) {
                    const entryStart = entryStarts[i];
                    const nextEntryStart = i < entryStarts.length - 1 ? entryStarts[i + 1] : entriesContent.length;
                    
                    // Extract this entry and check if it's complete
                    let entryContent = entriesContent.substring(entryStart, nextEntryStart);
                    
                    // For the last entry, try to find its natural ending
                    if (i === entryStarts.length - 1) {
                        // Look for the last complete structure
                        // An entry should end with } followed by optional comma
                        // Count braces to find proper ending
                        let braceCount = 0;
                        let properEnd = -1;
                        let inString = false;
                        let escapeNext = false;
                        
                        for (let j = 0; j < entryContent.length; j++) {
                            const char = entryContent[j];
                            
                            if (escapeNext) {
                                escapeNext = false;
                                continue;
                            }
                            
                            if (char === '\\') {
                                escapeNext = true;
                                continue;
                            }
                            
                            if (char === '"' && !escapeNext) {
                                inString = !inString;
                                continue;
                            }
                            
                            if (inString) continue;
                            
                            if (char === '{') braceCount++;
                            else if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    properEnd = j + 1;
                                    break;
                                }
                            }
                        }
                        
                        if (properEnd > 0) {
                            entryContent = entryContent.substring(0, properEnd);
                        }
                    }
                    
                    // Check if this entry is valid JSON
                    try {
                        JSON.parse(entryContent);
                        // This entry is complete! Rebuild from here
                        const validEntries = entriesContent.substring(0, entryStart + entryContent.length);
                        
                        // Remove trailing comma if present
                        let trimmedEntries = validEntries.trimEnd();
                        if (trimmedEntries.endsWith(',')) {
                            trimmedEntries = trimmedEntries.slice(0, -1);
                        }
                        
                        // Rebuild the HAR structure
                        fixedContent = beforeEntries + trimmedEntries + '\n]\n}\n}';
                        
                        // Verify it parses
                        JSON.parse(fixedContent);
                        
                        const droppedEntries = entryStarts.length - i - 1;
                        return {
                            fixed: true,
                            content: fixedContent,
                            error: droppedEntries > 0 
                                ? `Auto-fixed: Removed ${droppedEntries} incomplete entry/entries at end of file`
                                : 'Auto-fixed: Added missing closing brackets'
                        };
                    } catch {
                        // This entry is incomplete, try the previous one
                        continue;
                    }
                }
            }
        }
        
        // Fallback to simple brace counting fix
        let openBraces = 0;
        let closeBraces = 0;
        let openBrackets = 0;
        let closeBrackets = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < harContent.length; i++) {
            const char = harContent[i];
            
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
            }
            
            if (inString) continue;
            
            if (char === '{') openBraces++;
            else if (char === '}') closeBraces++;
            else if (char === '[') openBrackets++;
            else if (char === ']') closeBrackets++;
        }
        
        const missingCloseBrackets = openBrackets - closeBrackets;
        const missingCloseBraces = openBraces - closeBraces;
        
        if (missingCloseBrackets > 0 || missingCloseBraces > 0) {
            fixedContent = harContent.trimEnd();
            
            // Remove trailing comma if present
            if (fixedContent.endsWith(',')) {
                fixedContent = fixedContent.slice(0, -1);
            }
            
            // Add missing closing brackets and braces
            for (let i = 0; i < missingCloseBrackets; i++) {
                fixedContent += '\n]';
            }
            for (let i = 0; i < missingCloseBraces; i++) {
                fixedContent += '\n}';
            }
            
            try {
                JSON.parse(fixedContent);
                return { 
                    fixed: true, 
                    content: fixedContent,
                    error: `Auto-fixed: Added ${missingCloseBrackets} ']' and ${missingCloseBraces} '}'`
                };
            } catch (parseError: any) {
                return { 
                    fixed: false, 
                    content: harContent,
                    error: `Could not auto-fix: ${parseError.message}`
                };
            }
        }
        
        return { 
            fixed: false, 
            content: harContent,
            error: errorMessage
        };
    }
}

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

        // Command to open HAR as raw JSON
        const openRawCommand = vscode.commands.registerCommand('trafficRecorder.openRawHAR', async (uri?: vscode.Uri) => {
            const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
            if (fileUri) {
                // Force open with default text editor (override custom editor)
                const doc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(doc, {
                    viewColumn: vscode.ViewColumn.Active,
                    preview: false,
                    preserveFocus: false
                });
                
                // Set language to JSON for syntax highlighting
                await vscode.languages.setTextDocumentLanguage(doc, 'json');
            } else {
                vscode.window.showErrorMessage('No HAR file selected');
            }
        });

        // Register custom editor for .har files
        const customEditorProvider = vscode.window.registerCustomEditorProvider(
            HARViewerProvider.viewType,
            {
                async openCustomDocument(uri: vscode.Uri) {
                    return { uri, dispose: () => {} };
                },
                async resolveCustomEditor(document: { uri: vscode.Uri }, webviewPanel: vscode.WebviewPanel) {
                    provider.setupWebviewPanel(webviewPanel, document.uri);
                }
            },
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );

        return [previewCommand, openRawCommand, customEditorProvider];
    }

    private async setupWebviewPanel(panel: vscode.WebviewPanel, uri: vscode.Uri) {
        const panelKey = uri.fsPath;
        HARViewerProvider._panels.set(panelKey, panel);

        // Configure webview
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'dist', 'har-viewer'),
            ]
        };

        // Load HAR file content
        let harContent: string;
        
        try {
            const fileContent = await vscode.workspace.fs.readFile(uri);
            harContent = Buffer.from(fileContent).toString('utf8');
            
            // Remove BOM if present
            if (harContent.charCodeAt(0) === 0xFEFF) {
                harContent = harContent.substring(1);
            }
            
            // Try to fix truncated HAR files
            const fixResult = fixTruncatedHAR(harContent);
            if (fixResult.fixed) {
                harContent = fixResult.content;
                const fixMessage = fixResult.error || 'File was auto-fixed';
                
                // Automatically save the fixed version without asking
                try {
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(harContent, 'utf8'));
                    // Show non-intrusive notification that fix was applied
                    vscode.window.showInformationMessage(`HAR file auto-fixed: ${fixMessage}`, { modal: false });
                } catch (saveError: any) {
                    vscode.window.showWarningMessage(`Auto-fix applied but couldn't save: ${saveError.message}. Using temporary fix.`);
                }
            } else if (fixResult.error) {
                // Show error but don't throw - try to display what we can
                vscode.window.showWarningMessage(`HAR file has errors: ${fixResult.error}. Attempting to display anyway.`);
            }
            
            // Try to validate - if it fails, still attempt to show in viewer
            try {
                JSON.parse(harContent);
            } catch (parseError: any) {
                vscode.window.showWarningMessage(`HAR file is not valid JSON: ${parseError.message}. Viewer may not work correctly.`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load HAR file: ${error}`);
            panel.webview.html = `<html><body><h1>Error loading HAR file</h1><p>${error}</p></body></html>`;
            return;
        }

        // Set HTML content
        panel.webview.html = this._getHtmlForWebview(panel.webview);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'ready':
                        panel.webview.postMessage({
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
        });

        // Update panel when file changes
        const fileWatcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);
        fileWatcher.onDidChange(async () => {
            try {
                const fileContent = await vscode.workspace.fs.readFile(uri);
                let newContent = Buffer.from(fileContent).toString('utf8');
                
                if (newContent.charCodeAt(0) === 0xFEFF) {
                    newContent = newContent.substring(1);
                }
                
                JSON.parse(newContent);
                
                panel.webview.postMessage({
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
            
            // Try to fix truncated HAR files
            const fixResult = fixTruncatedHAR(harContent);
            if (fixResult.fixed) {
                harContent = fixResult.content;
                const fixMessage = fixResult.error || 'File was auto-fixed';
                
                // Automatically save the fixed version without asking
                try {
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(harContent, 'utf8'));
                    // Show non-intrusive notification that fix was applied
                    vscode.window.showInformationMessage(`HAR file auto-fixed: ${fixMessage}`, { modal: false });
                } catch (saveError: any) {
                    vscode.window.showWarningMessage(`Auto-fix applied but couldn't save: ${saveError.message}. Using temporary fix.`);
                }
            } else if (fixResult.error) {
                // Show error but don't throw - try to display what we can
                vscode.window.showWarningMessage(`HAR file has errors: ${fixResult.error}. Attempting to display anyway.`);
            }
            
            // Try to validate - if it fails, still attempt to show in viewer
            try {
                JSON.parse(harContent);
            } catch (parseError: any) {
                vscode.window.showWarningMessage(`HAR file is not valid JSON: ${parseError.message}. Viewer may not work correctly.`);
            }
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
