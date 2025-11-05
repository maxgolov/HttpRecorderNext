# HttpRecorder Dev Proxy Extension

This directory contains a Microsoft Dev Proxy plugin that integrates HttpRecorder to capture HTTP traffic and save it as HAR (HTTP Archive) files.

## Overview

The HttpRecorder Dev Proxy plugin allows you to:
- Intercept HTTP requests and responses passing through Dev Proxy
- Record them using the HttpRecorder library
- Save interactions as HAR files for later replay or analysis
- Anonymize sensitive data like authorization headers
- Filter which URLs to record

## Project Structure

```
DevProxyExtension/
├── HttpRecorder.DevProxy/
│   ├── HttpRecorderPlugin.cs              # Main plugin implementation
│   ├── HttpRecorderPluginConfiguration.cs # Plugin configuration class
│   ├── BasePlugin.cs                      # Base class stub (replace with DevProxy.Abstractions)
│   └── HttpRecorder.DevProxy.csproj       # Project file
├── README.md                               # This file
└── devproxyrc.example.json                # Example Dev Proxy configuration
```

## Prerequisites

1. **Microsoft Dev Proxy** - Install using winget (recommended):
   ```powershell
   # Stable version
   winget install DevProxy.DevProxy --silent
   
   # OR Beta version (for latest preview features)
   winget install DevProxy.DevProxy.Beta --silent
   ```
   
   **Important**: After installation, restart your command prompt to refresh the PATH environment variable.
   
   Alternative: Manual installation from [Microsoft Dev Proxy Documentation](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)

2. **.NET 9.0 SDK** - Required for building the plugin

### First Time Setup

When you start Dev Proxy for the first time:

1. **Trust the certificate**: Dev Proxy installs a certificate named "Dev Proxy CA". Select **Yes** to confirm installation.
2. **Allow firewall access**: Windows Firewall will show a warning. Select **Allow access** to permit traffic through the firewall.

Dev Proxy will display:
```
 info    Dev Proxy API listening on http://localhost:8897...
 info    Dev Proxy Listening on 127.0.0.1:8000...

Hotkeys: issue (w)eb request, (r)ecord, (s)top recording, (c)lear screen
Press CTRL+C to stop Dev Proxy
```

**Important**: Always stop Dev Proxy using **Ctrl+C** to safely unregister it as the system proxy. Closing the terminal without stopping Dev Proxy may cause connection issues.

## Building the Plugin

```powershell
# From the DevProxyExtension directory
cd HttpRecorder.DevProxy
dotnet build

# The plugin DLL will be at:
# bin/Debug/net9.0/HttpRecorder.DevProxy.dll
```

## Configuration

### Dev Proxy Configuration

Create or update your `devproxyrc.json` file:

```json
{
  "plugins": [
    {
      "name": "HttpRecorderPlugin",
      "enabled": true,
      "pluginPath": "./DevProxyExtension/HttpRecorder.DevProxy/bin/Debug/net9.0/HttpRecorder.DevProxy.dll",
      "configSection": "httpRecorder"
    }
  ],
  "urlsToWatch": [
    "https://api.example.com/*",
    "https://graph.microsoft.com/*"
  ],
  "httpRecorder": {
    "outputDirectory": "./recordings",
    "mode": "Record",
    "includeBodies": true,
    "anonymizeSensitiveData": true,
    "sensitiveHeaders": [
      "Authorization",
      "Cookie",
      "Set-Cookie",
      "X-API-Key",
      "X-Auth-Token"
    ]
  }
}
```

### Configuration Options

- **outputDirectory**: Directory where HAR files will be saved (default: `./recordings`)
- **mode**: Recording mode - currently supports "Record" (default)
- **includeBodies**: Whether to include request/response bodies (default: `true`)
- **anonymizeSensitiveData**: Redact sensitive headers (default: `true`)
- **sensitiveHeaders**: Array of header names to anonymize

## Running Dev Proxy with the Plugin

```powershell
# Start Dev Proxy with your configuration
devproxy --config-file devproxyrc.json

# Or if devproxyrc.json is in the current directory
devproxy

# For beta version
devproxy-beta --config-file devproxyrc.json
```

### Verifying Dev Proxy is Working

Before using the plugin, confirm Dev Proxy is intercepting requests:

```powershell
# Test with Invoke-WebRequest (PowerShell)
Invoke-WebRequest -Uri https://jsonplaceholder.typicode.com/posts

# Or with curl
curl -ikx http://localhost:8000 https://jsonplaceholder.typicode.com/posts
```

You should see output in the Dev Proxy terminal like:
```
 req   ╭ GET https://jsonplaceholder.typicode.com/posts
 time  │ 1/31/2025 12:12:14 PM +00:00
 api   ╰ Passed through
```

## How It Works

1. **Request Interception**: When Dev Proxy intercepts an HTTP request matching `urlsToWatch`, the `BeforeRequestAsync` method is called
2. **Request Recording**: The plugin creates an `Interaction` object and stores request details (URL, method, headers, body)
3. **Response Interception**: When the response arrives, `AfterResponseAsync` is called
4. **Response Recording**: The plugin updates the interaction with response details (status code, headers, body, timing)
5. **HAR Export**: The complete interaction is saved as a HAR file using `HttpArchiveInteractionRepository`

## HAR File Output

Each recorded interaction is saved as a separate HAR file:

```
recordings/
├── 20251104_143022_1_api_example_com_users.har
├── 20251104_143023_2_api_example_com_orders.har
└── ...
```

Filenames include:
- Timestamp (yyyyMMdd_HHmmss)
- Interaction ID
- Sanitized URL path

## Integration with Dev Proxy Abstractions

**Note**: The current implementation includes a stub `BasePlugin.cs` class. For production use:

1. Install Dev Proxy and locate `DevProxy.Abstractions.dll`
2. Add it as a reference in the `.csproj` file:

```xml
<ItemGroup>
  <Reference Include="DevProxy.Abstractions">
    <HintPath>path/to/DevProxy.Abstractions.dll</HintPath>
  </Reference>
</ItemGroup>
```

3. Remove the stub `BasePlugin.cs` file
4. Update imports to use `DevProxy.Abstractions` namespace

## Use Cases

- **API Testing**: Record API interactions for test fixtures
- **Documentation**: Generate HAR files to document API behavior
- **Debugging**: Capture full request/response cycles for troubleshooting
- **Replay**: Save production traffic for replay in test environments
- **Analysis**: Analyze API performance and payloads

## Example Workflow

```powershell
# 1. Build the plugin
cd DevProxyExtension/HttpRecorder.DevProxy
dotnet build

# 2. Configure Dev Proxy (edit devproxyrc.json)

# 3. Start Dev Proxy
devproxy

# 4. Configure your application to use the proxy
$env:HTTP_PROXY = "http://localhost:8000"
$env:HTTPS_PROXY = "http://localhost:8000"

# 5. Run your application
# HTTP traffic will be recorded to ./recordings/

# 6. Stop Dev Proxy (Ctrl+C)

# 7. Review HAR files
ls ./recordings/*.har
```

## Viewing HAR Files

HAR files can be viewed in:
- Chrome DevTools (Network tab → Import HAR)
- Firefox DevTools (Network tab → Import HAR)
- [HAR Viewer](http://www.softwareishard.com/har/viewer/)
- [Charles Proxy](https://www.charlesproxy.com/)
- [Fiddler](https://www.telerik.com/fiddler)

## Advanced Usage

### Custom Anonymization Rules

Extend the plugin to add custom anonymization logic:

```csharp
private void AnonymizeSensitiveHeaders(Dictionary<string, string> headers)
{
    // Existing logic...
    
    // Custom: Anonymize API keys in query strings
    if (headers.ContainsKey("X-Custom-Header"))
    {
        headers["X-Custom-Header"] = MaskApiKey(headers["X-Custom-Header"]);
    }
}
```

### Filtering Requests

Modify `BeforeRequestAsync` to add custom filtering:

```csharp
public override Task BeforeRequestAsync(ProxyRequestArgs e)
{
    // Only record POST/PUT requests
    if (e.Session.HttpClient.Request.Method != "POST" && 
        e.Session.HttpClient.Request.Method != "PUT")
    {
        return Task.CompletedTask;
    }
    
    // Continue with recording...
}
```

## Troubleshooting

### Plugin Not Loading
- Verify the `pluginPath` in `devproxyrc.json` is correct
- Check that the DLL was built successfully
- Ensure .NET 9.0 runtime is installed

### No HAR Files Generated
- Check the `outputDirectory` has write permissions
- Verify `urlsToWatch` patterns match your requests
- Check Dev Proxy console for error messages

### Missing Request/Response Bodies
- Set `includeBodies: true` in configuration
- Some content types may not be captured (binary, streaming)

## Contributing

This plugin is part of the HttpRecorder.Next project. See the main README for contribution guidelines.

## License

MIT License - see LICENSE file in the project root.

## References

- [Microsoft Dev Proxy Documentation](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/)
- [Creating Custom Dev Proxy Plugins](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/how-to/create-custom-plugin)
- [HAR Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [HttpRecorder.Next Repository](https://github.com/maxgolov/HttpRecorderNext)
