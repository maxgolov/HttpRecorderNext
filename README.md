# HttpRecorder - HTTP Traffic Recording for .NET

Record and replay HTTP interactions in HAR format for testing, debugging, and API documentation.

> **Note:** This is a modernized fork of the [original HttpRecorder by nventive](https://github.com/nventive/HttpRecorder), maintained by **Max Golovanov** ([max.golovanov+github@gmail.com](mailto:max.golovanov+github@gmail.com)). Features .NET 8/9 support, Dev Proxy plugin, VS Code extension, and modern APIs.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-blue.svg)](https://dotnet.microsoft.com/download/dotnet/8.0)
[![.NET 9](https://img.shields.io/badge/.NET-9.0-blue.svg)](https://dotnet.microsoft.com/download/dotnet/9.0)
![Nuget](https://img.shields.io/nuget/v/HttpRecorder.Next.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)

## What's New

**3 Ways to Record HTTP Traffic:**

1. **VS Code Extension** - Record browser traffic during Playwright tests (290 KB, self-contained)
2. **.NET Library** - Record HttpClient traffic in your code (40 KB)
3. **Dev Proxy Plugin** - Record ANY HTTP traffic through proxy (25 KB plugin + 123 MB Dev Proxy)

## Quick Start

### Option 1: VS Code Extension (Browser Testing)

```bash
# Install from VSIX (Marketplace coming soon)
code --install-extension traffic-recorder-0.4.0.vsix
```

**Features:**
- ✅ Record Playwright browser traffic to HAR files
- ✅ Self-contained setup (like Python .venv)
- ✅ Automatic anonymization of sensitive data
- ✅ One-click start/stop from VS Code

See [Traffic Recorder Extension docs](docs/TRAFFIC_RECORDER_EXTENSION.md) for details.

---

### Option 2: .NET Library (HttpClient Recording)

### Option 2: .NET Library (HttpClient Recording)

```bash
dotnet add package HttpRecorder.Next
```

```csharp
using HttpRecorder;

// Record HTTP traffic
var handler = new HttpRecorderDelegatingHandler("recordings/api.har");
var client = new HttpClient(handler) { 
    InnerHandler = new HttpClientHandler() 
};

await client.GetAsync("https://api.example.com/users");
// Traffic saved to recordings/api.har
```

---

### Option 3: Dev Proxy Plugin (Any HTTP Traffic)

```bash
# Install plugin
dotnet add package HttpRecorder.DevProxy

# Configure devproxyrc.json
{
  "plugins": [{
    "name": "HttpRecorderPlugin",
    "pluginPath": "./bin/plugins/HttpRecorder.DevProxy.dll",
    "configSection": "httpRecorder"
  }],
  "httpRecorder": {
    "outputDirectory": ".",
    "mode": "Record"
  }
}

# Start Dev Proxy
devproxy-beta --config-file devproxyrc.json
```

**Note:** Only 2 DLLs needed (65 KB) - BouncyCastle and Titanium.Web.Proxy already in Dev Proxy!

---

## Integration Test Example

```csharp
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using HttpRecorder;
using Xunit;

namespace Sample
{
    public class SampleIntegrationTests
    {
        [Fact]
        public async Task ItShould()
        {
            // Initialize the HttpClient with the recorded file
            // stored in a fixture repository.
            var client = CreateHttpClient();

            // Performs HttpClient operations.
            // The interaction is recorded if there are no record,
            // or replayed if there are
            // (without actually hitting the target API).
            // Fixture is recorded in the SampleIntegrationTestsFixtures\ItShould.har file.
            var response = await client.GetAsync("api/user");

            // Performs assertions.
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        private HttpClient CreateHttpClient(
            [CallerMemberName] string testName = "",
            [CallerFilePath] string filePath = "")
        {
            // The location of the file where the interaction is recorded.
            // We use the C# CallerMemberName/CallerFilePath attributes to
            // automatically set an appropriate path based on the test case.
            var interactionFilePath = Path.Join(
                Path.GetDirectoryName(filePath),
                $"{Path.GetFileNameWithoutExtension(filePath)}Fixtures",
                testName);

            // Initialize the HttpClient with HttpRecorderDelegatingHandler, which
            // records and replays the interactions.
            // Do not forget to set the InnerHandler property.
            return new HttpClient(
                new HttpRecorderDelegatingHandler(interactionFilePath) { InnerHandler = new HttpClientHandler() })
            {
                BaseAddress = new Uri("https://reqres.in/"),
            };
        }
    }
}
```

}

## Key Features

✅ **Standard HAR Format** - Compatible with Chrome DevTools, Fiddler, HAR Viewer  
✅ **Auto Record/Replay** - Record once, replay in tests (no network calls)  
✅ **Anonymization** - Redact auth tokens, cookies, API keys automatically  
✅ **HttpClientFactory Support** - First-class ASP.NET Core integration  
✅ **Custom Matchers** - Control how requests are matched for replay  
✅ **Multiple Modes** - Record, Replay, Auto, Passthrough  
✅ **Minimal Overhead** - Extension 290 KB, Library 40 KB, Plugin 25 KB  

## Advanced Features

## Advanced Features

### Recording Modes

### Recording Modes

The `HttpRecorderDelegatingHandler` supports multiple modes:

| Mode | Behavior |
|------|----------|
| **Auto** | Default - replay if recording exists, otherwise record |
| **Record** | Always record, even if recording exists |
| **Replay** | Always replay, throw if no recording |
| **Passthrough** | Pass through without recording or replay |

```csharp
// Set mode explicitly
var handler = new HttpRecorderDelegatingHandler(
    "recordings/api.har", 
    mode: HttpRecorderMode.Replay
);

// Or override via environment variable
// Environment.SetEnvironmentVariable("HTTP_RECORDER_MODE", "Replay");
```

```

---

### Custom Request Matching

### Custom Request Matching

Default: Match by HTTP method + complete URI. Customize with `RulesMatcher`:

```csharp
using HttpRecorder.Matchers;

// Match once in order (no comparison)
var matcher = RulesMatcher.MatchOnce;

// Match by HTTP method only
matcher = RulesMatcher.MatchOnce.ByHttpMethod();

// Match by method + path + header (ignore query string)
matcher = RulesMatcher.MatchMultiple
    .ByHttpMethod()
    .ByRequestUri(UriPartial.Path)
    .ByHeader("X-API-Key");

// Custom rule
matcher = RulesMatcher.MatchOnce.By((request, message) => 
    request.RequestUri?.Host == message.Request.Url.Host
);

var client = new HttpClient(
    new HttpRecorderDelegatingHandler("...", matcher: matcher)
);
```

---

### Data Anonymization

### Data Anonymization

Redact sensitive data before recording:

```csharp
using HttpRecorder.Anonymizers;

var anonymizer = RulesInteractionAnonymizer.Default
    .AnonymizeRequestQueryStringParameter("api_key")
    .AnonymizeRequestHeader("Authorization")
    .AnonymizeResponseHeader("Set-Cookie");

var client = new HttpClient(
    new HttpRecorderDelegatingHandler("...", anonymizer: anonymizer)
);
```

---

### HttpClientFactory Integration

### HttpClientFactory Integration

ASP.NET Core first-class support:

```csharp
// Startup.cs / Program.cs
services
    .AddHttpClient("github")
    .AddHttpRecorder("recordings/github.har");

// Use in controllers
public class DataController : ControllerBase
{
    private readonly IHttpClientFactory _factory;
    
    public DataController(IHttpClientFactory factory) => _factory = factory;
    
    [HttpGet("user/{id}")]
    public async Task<IActionResult> GetUser(string id)
    {
        var client = _factory.CreateClient("github");
        var response = await client.GetAsync($"https://api.github.com/users/{id}");
        return Ok(await response.Content.ReadAsStringAsync());
    }
}
```

---

### Recorder Context (Advanced)

### Recorder Context (Advanced)

For ASP.NET Core integration tests, separate handler injection from test setup:

```csharp
// In WebApplicationFactory.ConfigureWebHost:
services.AddHttpRecorderContextSupport();

// In test cases:
[Fact]
public async Task ItShould()
{
    using var context = new HttpRecorderContext();
    // ... perform test, interactions recorded automatically
}

// Per-client configuration:
[Fact]
public async Task CustomConfig()
{
    using var context = new HttpRecorderContext((sp, builder) =>
        builder.Name switch
        {
            "TypedClient" => new HttpRecorderConfiguration
            {
                Matcher = RulesMatcher.MatchMultiple
            },
            "DisabledClient" => new HttpRecorderConfiguration
            {
                Enabled = false
            },
            _ => null
        });
    // ... perform test
}
```

---

## Distribution & Package Sizes

| Package | Size | What's Included |
|---------|------|-----------------|
| **VS Code Extension** | 290 KB | Extension + 2 plugin DLLs (self-contained) |
| **HttpRecorder.Next** | ~40 KB | Core library |
| **HttpRecorder.DevProxy** | ~25 KB | Dev Proxy plugin |

**Why so small?** Dev Proxy (123 MB) already includes Titanium.Web.Proxy and BouncyCastle. Our plugin leverages these at runtime instead of bundling them.

### Installation

```bash
# VS Code Extension (VSIX direct install)
code --install-extension traffic-recorder-0.4.0.vsix

# NuGet packages
dotnet add package HttpRecorder.Next         # Core library
dotnet add package HttpRecorder.DevProxy     # Dev Proxy plugin

# VS Code Marketplace (coming soon)
code --install-extension maxgolov.traffic-recorder
```

---

## Version Compatibility

- **Dev Proxy:** v1.3.0-beta.2 or later
- **.NET:** 8.0 or 9.0
- **VS Code:** 1.105.0 or later
- **Node.js:** 20.0.0 or later (extension development only)

---

## Viewing HAR Files

HAR files can be viewed in:

1. **Chrome DevTools** - Network tab → Right-click → Import HAR
2. **Fiddler** - File → Import → HAR
3. **Online HAR Viewer** - http://www.softwareishard.com/har/viewer/
4. **VS Code** - Install HAR viewer extensions

---

## Documentation

- [Traffic Recorder Extension](docs/TRAFFIC_RECORDER_EXTENSION.md) - Complete VS Code extension guide
- [Plugin Development](DevProxyExtension/README.md) - Dev Proxy plugin details
- [Changelog](CHANGELOG.md) - Version history
- [Contributing](CONTRIBUTING.md) - Contribution guidelines

---


## Changelog

### v0.4.0 (2025-11-05)

**Breaking Changes:**
- Removed bundled BouncyCastle and Titanium.Web.Proxy DLLs (already in Dev Proxy)

**Improvements:**
- Extension size reduced from 4.89 MB to 290 KB (94% reduction)
- Self-contained `.http-recorder/bin/plugins/` structure (like Python .venv)
- Relative paths in configuration (portable across machines)
- Optimized plugin dependencies (only 2 DLLs needed)

**Fixed:**
- Directory navigation in VS Code Explorer
- Plugin loading with minimal dependencies
- HAR file path logging (forward slashes)

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

## Troubleshooting

**Plugin not loading in Dev Proxy?**
- Ensure plugin path is correct in `devproxyrc.json`
- Verify .NET 9.0 runtime installed
- Check Dev Proxy logs for error messages

**HAR files not created?**
- Verify `outputDirectory` exists and is writable
- Check `mode: "Record"` in configuration
- Review Dev Proxy console output

**Extension not starting?**
- Install Dev Proxy: `winget install Microsoft.DevProxy.Beta`
- Check VS Code Output panel for errors
- Ensure port 8000 is available

---

## License

This project is licensed under the Apache 2.0 license - see the
[LICENSE](LICENSE) file for details.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on the process for
contributing to this project.

Be mindful of our [Code of Conduct](CODE_OF_CONDUCT.md).

## Acknowledgments

- https://github.com/vcr/vcr
- https://github.com/nock/nock
- https://github.com/mleech/scotch
- https://github.com/nventive/HttpRecorder
