# Language Model Tools Integration

## Overview

This extension now provides **dual approaches** for starting Dev Proxy, optimized for different use cases:

1. **MCP Tool** (`start_proxy`): Detached shell process - optimal for AI automation
2. **Language Model Tool** (`traffic-recorder_startProxyInTerminal`): VS Code terminal - optimal for interactive debugging

## Implementation

### Language Model Tool (New)

**Tool ID**: `traffic-recorder_startProxyInTerminal`

**Purpose**: Start Dev Proxy in VS Code integrated terminal with visible output

**Registration** (in `extension.ts`):
```typescript
context.subscriptions.push(
  vscode.lm.registerTool('traffic-recorder_startProxyInTerminal', {
    async invoke(_options, _token) {
      try {
        await vscode.commands.executeCommand('traffic-recorder.startProxy');
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('Dev Proxy started successfully in VS Code terminal...')
        ]);
      } catch (error) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Failed to start Dev Proxy: ${error.message}`)
        ]);
      }
    }
  })
);
```

**How Language Models can use it**:
- Available directly to GitHub Copilot and other Language Models in VS Code
- Can be invoked when user wants to see proxy output or interact with it
- Provides immediate feedback about success/failure
- Shows proxy logs in VS Code terminal for debugging

### MCP Tool (Updated)

**Tool Name**: `start_proxy`

**Purpose**: Start Dev Proxy as detached background process

**Updated Response** (in `server.ts`):
```json
{
  "status": "success",
  "message": "Dev Proxy started successfully in a separate background shell",
  "pid": 12345,
  "proxyPort": 8080,
  "apiPort": 8897,
  "mode": "detached",
  "hint": "HttpRecorder is now capturing all HTTP traffic to HAR files. The proxy runs independently in a separate process.",
  "alternativeNote": "To start the proxy in VS Code terminal with visible output, suggest using the traffic-recorder_startProxyInTerminal Language Model tool or the VS Code command: traffic-recorder.startProxy"
}
```

**Key Changes**:
- Added `mode: "detached"` to clarify execution context
- Added `alternativeNote` field explaining terminal option
- Updated JSDoc comment to document both approaches

## Usage Guidance for Language Models

### When to use MCP `start_proxy`:
- Automated workflows where output visibility is not needed
- Background service startup
- AI-driven test automation
- Situations where process should run independently

### When to use LM Tool `traffic-recorder_startProxyInTerminal`:
- User wants to see proxy logs
- Debugging proxy behavior
- Interactive development sessions
- User explicitly asks for terminal output

### Example AI Response Pattern:

**User**: "Start the dev proxy so I can see what's happening"

**Suggested AI Response**:
```
I'll start the Dev Proxy in your VS Code terminal so you can see the output.

[Invoke: traffic-recorder_startProxyInTerminal]

The proxy is now running in your terminal. You can see all HTTP requests being captured
and any errors that occur. To stop it, use the stop_proxy tool or close the terminal.
```

**User**: "Start the proxy and begin automated testing"

**Suggested AI Response**:
```
I'll start the Dev Proxy in the background for automated testing.

[Invoke MCP: start_proxy]

The proxy is running in a detached process and capturing all HTTP traffic. 
It will continue running even if this chat session ends. Use proxy_status to 
check if it's ready, and stop_proxy when testing is complete.
```

## Architecture Details

### Language Model Tool (VS Code Native)
- **Process**: Runs within VS Code extension host
- **Access**: Full VS Code API (`vscode.commands`, `vscode.window`, etc.)
- **Output**: Visible in VS Code integrated terminal
- **Lifecycle**: Tied to VS Code window
- **UI Integration**: Shows in Terminal panel, can interact with status bar
- **User Visibility**: High - users see all output in real-time

### MCP Tool (Isolated Process)
- **Process**: Separate Node.js stdio process
- **Access**: No VS Code API (isolated by design)
- **Output**: Detached shell with `stdio: 'ignore'`
- **Lifecycle**: Independent of VS Code
- **UI Integration**: None - fully automated
- **User Visibility**: Low - only status checks via API

## Benefits of Dual Approach

1. **Best of Both Worlds**:
   - MCP tool: Simple, reliable, automated
   - LM tool: Interactive, visible, debuggable

2. **Clear Separation of Concerns**:
   - Automation vs. Human Interaction
   - Background vs. Foreground execution
   - Independent vs. Integrated processes

3. **User Choice**:
   - Language models can intelligently choose based on context
   - Users can explicitly request their preferred mode
   - Both approaches are documented and explained

4. **Future-Proof**:
   - MCP isolation model is architecturally sound
   - Language Model tools provide proper VS Code integration
   - No hacks or workarounds required

## Testing

After installing the updated extension:

1. **Test Language Model Tool**:
   ```
   Ask Copilot: "Start the proxy in a terminal"
   Expected: Copilot invokes traffic-recorder_startProxyInTerminal
   Result: Proxy starts in VS Code terminal with visible output
   ```

2. **Test MCP Tool**:
   ```
   Ask Copilot: "Start the proxy in the background"
   Expected: Copilot invokes MCP start_proxy tool
   Result: Proxy starts detached, returns status with explanatory message
   ```

3. **Test Guidance**:
   ```
   Ask Copilot: "I want to start the proxy"
   Expected: Copilot asks clarification or makes intelligent choice
   Result: Appropriate tool used based on conversation context
   ```

## Migration Notes

- Existing MCP `start_proxy` behavior unchanged (detached shell)
- New Language Model tool added (terminal mode)
- Both approaches fully functional and documented
- No breaking changes to existing workflows
