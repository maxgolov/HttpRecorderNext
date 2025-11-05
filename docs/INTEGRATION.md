# HttpRecorder Integration Guide

This guide explains how to integrate **HttpRecorder** into existing .NET applications and leverage it as a proxy for recording HTTP interactions in the HAR (HTTP Archive) format.

## Table of Contents

- [Overview](#overview)
- [Basic Integration Scenarios](#basic-integration-scenarios)
  - [Console Applications](#console-applications)
  - [ASP.NET Core Applications](#aspnet-core-applications)
  - [Desktop Applications (WPF/WinForms)](#desktop-applications-wpfwinforms)
- [Using HttpRecorder as a Recording Proxy](#using-httprecorder-as-a-recording-proxy)
- [Advanced Integration Patterns](#advanced-integration-patterns)
  - [Dependency Injection](#dependency-injection)
  - [Named and Typed HttpClients](#named-and-typed-httpclients)
  - [Third-Party HTTP Libraries](#third-party-http-libraries)
- [Production Considerations](#production-considerations)
- [HAR Archive Management](#har-archive-management)
- [Best Practices](#best-practices)

---

## Overview

**HttpRecorder** is a `DelegatingHandler` for `HttpClient` that can record and replay HTTP interactions. It intercepts HTTP requests and responses, storing them in the [HAR (HTTP Archive) format](https://en.wikipedia.org/wiki/.har), which is a standard JSON-based format for logging HTTP transactions.

### Installation

Install the package from NuGet:

```powershell
dotnet add package HttpRecorder.Next
```

Or via Package Manager Console:

```powershell
Install-Package HttpRecorder.Next
```

### Key Features for Integration

- **Non-invasive**: Works as an `HttpMessageHandler`, requiring minimal code changes
- **Standard Format**: Uses HAR format, compatible with tools like Fiddler, Charles Proxy, and Chrome DevTools
- **Multiple Modes**: Record, Replay, Auto, and Passthrough modes for different scenarios
- **Anonymization**: Built-in support for sanitizing sensitive data before recording
- **HttpClientFactory Support**: First-class integration with .NET's `IHttpClientFactory`

---

## Basic Integration Scenarios

### Console Applications

For console applications using `HttpClient` directly, wrap your `HttpClient` with `HttpRecorderDelegatingHandler`:

```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;
using HttpRecorder;

namespace MyConsoleApp
{
    class Program
    {
        static async Task Main(string[] args)
        {
            // Create an HttpClient with recording capabilities
            using var httpClient = CreateRecordingHttpClient("recordings/api-calls");
            
            // Use the client as normal - all interactions are recorded
            var response = await httpClient.GetAsync("https://api.example.com/data");
            var content = await response.Content.ReadAsStringAsync();
            
            Console.WriteLine(content);
        }

        static HttpClient CreateRecordingHttpClient(string interactionName)
        {
            return new HttpClient(
                new HttpRecorderDelegatingHandler(
                    interactionName,
                    mode: HttpRecorderMode.Record  // Always record in this example
                )
                {
                    InnerHandler = new HttpClientHandler()
                })
            {
                Timeout = TimeSpan.FromSeconds(30)
            };
        }
    }
}
```

### ASP.NET Core Applications

For ASP.NET Core applications, integrate HttpRecorder with the `IHttpClientFactory`:

**Startup.cs / Program.cs:**

```csharp
using HttpRecorder;
using Microsoft.Extensions.DependencyInjection;

public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        // Basic integration for a specific named client
        services
            .AddHttpClient("ApiClient")
            .AddHttpRecorder("recordings/api-interactions");

        // Or with a typed client
        services
            .AddHttpClient<IApiService, ApiService>()
            .AddHttpRecorder("recordings/api-service");

        // Add other services
        services.AddControllers();
    }
}
```

**Using in a Controller:**

```csharp
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class DataController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;

    public DataController(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetExternalData()
    {
        // The HttpClient automatically includes recording capabilities
        var httpClient = _httpClientFactory.CreateClient("ApiClient");
        var response = await httpClient.GetAsync("https://api.example.com/data");
        
        if (!response.IsSuccessStatusCode)
            return StatusCode((int)response.StatusCode);
        
        var content = await response.Content.ReadAsStringAsync();
        return Ok(content);
    }
}
```

### Desktop Applications (WPF/WinForms)

For desktop applications, you can integrate HttpRecorder using dependency injection or direct instantiation:

**With Dependency Injection (recommended):**

```csharp
using System;
using System.Net.Http;
using System.Windows;
using HttpRecorder;
using Microsoft.Extensions.DependencyInjection;

namespace MyWpfApp
{
    public partial class App : Application
    {
        private ServiceProvider _serviceProvider;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            
            var services = new ServiceCollection();
            ConfigureServices(services);
            _serviceProvider = services.BuildServiceProvider();
            
            var mainWindow = _serviceProvider.GetRequiredService<MainWindow>();
            mainWindow.Show();
        }

        private void ConfigureServices(IServiceCollection services)
        {
            // Register HttpClient with recording
            services
                .AddHttpClient("AppClient")
                .AddHttpRecorder("recordings/app-interactions");
            
            services.AddTransient<MainWindow>();
            services.AddSingleton<IDataService, DataService>();
        }
    }
}
```

**Direct Instantiation:**

```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;
using HttpRecorder;

namespace MyWinFormsApp
{
    public class ApiHelper
    {
        private static readonly HttpClient _httpClient = CreateHttpClient();

        private static HttpClient CreateHttpClient()
        {
            var recordingsPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MyApp",
                "recordings",
                "api-interactions"
            );

            return new HttpClient(
                new HttpRecorderDelegatingHandler(recordingsPath)
                {
                    InnerHandler = new HttpClientHandler()
                });
        }

        public static async Task<string> GetDataAsync()
        {
            var response = await _httpClient.GetAsync("https://api.example.com/data");
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }
    }
}
```

---

## Using HttpRecorder as a Recording Proxy

HttpRecorder can function as a transparent recording proxy for capturing HTTP traffic in your application. This is particularly useful for:

- **API Documentation**: Automatically generate API interaction examples
- **Debugging**: Capture and analyze production-like HTTP traffic
- **Testing**: Create test fixtures from real application usage
- **Compliance**: Record audit trails of external API calls

### Recording Proxy Setup

```csharp
using System;
using System.IO;
using System.Net.Http;
using HttpRecorder;
using HttpRecorder.Anonymizers;

namespace RecordingProxy
{
    public class HttpRecordingProxyFactory
    {
        private readonly string _recordingsDirectory;
        private readonly HttpRecorderMode _mode;

        public HttpRecordingProxyFactory(
            string recordingsDirectory = "recordings",
            HttpRecorderMode mode = HttpRecorderMode.Auto)
        {
            _recordingsDirectory = recordingsDirectory;
            _mode = mode;
            
            // Ensure recordings directory exists
            Directory.CreateDirectory(_recordingsDirectory);
        }

        public HttpClient CreateProxyClient(
            string clientName,
            bool anonymizeSensitiveData = true)
        {
            var interactionPath = Path.Combine(_recordingsDirectory, clientName);
            
            // Configure anonymizer to remove sensitive data
            var anonymizer = RulesInteractionAnonymizer.Default;
            if (anonymizeSensitiveData)
            {
                anonymizer = anonymizer
                    .AnonymizeRequestHeader("Authorization")
                    .AnonymizeRequestHeader("X-Api-Key")
                    .AnonymizeRequestHeader("Cookie")
                    .AnonymizeResponseHeader("Set-Cookie")
                    .AnonymizeRequestQueryStringParameter("api_key")
                    .AnonymizeRequestQueryStringParameter("token");
            }

            var handler = new HttpRecorderDelegatingHandler(
                interactionPath,
                mode: _mode,
                anonymizer: anonymizer)
            {
                InnerHandler = new HttpClientHandler
                {
                    // Configure as needed
                    AllowAutoRedirect = true,
                    AutomaticDecompression = System.Net.DecompressionMethods.All
                }
            };

            return new HttpClient(handler)
            {
                Timeout = TimeSpan.FromSeconds(100)
            };
        }
    }
}
```

### Usage Example

```csharp
// Create the proxy factory
var proxyFactory = new HttpRecordingProxyFactory(
    recordingsDirectory: "C:\\MyApp\\recordings",
    mode: HttpRecorderMode.Record  // Always record
);

// Create a proxied HttpClient
var httpClient = proxyFactory.CreateProxyClient(
    clientName: "github-api",
    anonymizeSensitiveData: true
);

// All HTTP calls are now recorded to HAR files
var response = await httpClient.GetAsync("https://api.github.com/users/octocat");
var json = await response.Content.ReadAsStringAsync();

// The interaction is saved to: C:\MyApp\recordings\github-api.har
```

### Organizing Recorded Archives

For applications with multiple API endpoints, organize recordings by service or feature:

```csharp
public class ApiRecordingService
{
    private readonly HttpRecordingProxyFactory _proxyFactory;
    private readonly Dictionary<string, HttpClient> _clients = new();

    public ApiRecordingService()
    {
        _proxyFactory = new HttpRecordingProxyFactory(
            Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "recordings",
                DateTime.Now.ToString("yyyy-MM-dd_HH-mm-ss")
            )
        );
    }

    public HttpClient GetClient(string serviceName)
    {
        if (!_clients.TryGetValue(serviceName, out var client))
        {
            client = _proxyFactory.CreateProxyClient(serviceName);
            _clients[serviceName] = client;
        }
        return client;
    }

    public void Dispose()
    {
        foreach (var client in _clients.Values)
        {
            client.Dispose();
        }
        _clients.Clear();
    }
}
```

---

## Advanced Integration Patterns

### Dependency Injection

For complex applications, use dependency injection to manage HttpRecorder configuration:

```csharp
using HttpRecorder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

public static class HttpRecorderServiceExtensions
{
    public static IServiceCollection AddHttpRecorderSupport(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Read configuration
        var recordingEnabled = configuration.GetValue<bool>("HttpRecorder:Enabled");
        var recordingPath = configuration["HttpRecorder:RecordingsPath"] ?? "recordings";
        var recordingMode = Enum.Parse<HttpRecorderMode>(
            configuration["HttpRecorder:Mode"] ?? "Auto"
        );

        if (!recordingEnabled)
        {
            // Just add regular HttpClient without recording
            services.AddHttpClient();
            return services;
        }

        // Add recording support to all HttpClients
        services.AddHttpRecorderContextSupport();
        
        // Configure default recording settings
        services.Configure<HttpRecorderOptions>(options =>
        {
            options.Mode = recordingMode;
            options.RecordingsPath = recordingPath;
        });

        return services;
    }
}
```

**appsettings.json:**

```json
{
  "HttpRecorder": {
    "Enabled": true,
    "Mode": "Auto",
    "RecordingsPath": "recordings"
  }
}
```

### Named and Typed HttpClients

Integrate HttpRecorder with both named and typed HttpClients:

```csharp
services
    .AddHttpClient("GithubApi", client =>
    {
        client.BaseAddress = new Uri("https://api.github.com/");
        client.DefaultRequestHeaders.Add("User-Agent", "MyApp");
    })
    .AddHttpRecorder("recordings/github-api");

services
    .AddHttpClient<IGithubService, GithubService>(client =>
    {
        client.BaseAddress = new Uri("https://api.github.com/");
    })
    .AddHttpRecorder("recordings/github-service");
```

### Third-Party HTTP Libraries

Some third-party libraries allow custom `HttpMessageHandler` injection:

**Refit Example:**

```csharp
using Refit;
using HttpRecorder;

// Define your API interface
public interface IGitHubApi
{
    [Get("/users/{user}")]
    Task<User> GetUser(string user);
}

// Create with recording support
var handler = new HttpRecorderDelegatingHandler("recordings/github-api")
{
    InnerHandler = new HttpClientHandler()
};

var httpClient = new HttpClient(handler)
{
    BaseAddress = new Uri("https://api.github.com")
};

var api = RestService.For<IGitHubApi>(httpClient);
var user = await api.GetUser("octocat");
```

**RestSharp Example:**

```csharp
using RestSharp;
using HttpRecorder;

// RestSharp uses HttpClient internally in newer versions
var handler = new HttpRecorderDelegatingHandler("recordings/api")
{
    InnerHandler = new HttpClientHandler()
};

var options = new RestClientOptions("https://api.example.com")
{
    ConfigureMessageHandler = _ => handler
};

var client = new RestClient(options);
var request = new RestRequest("/endpoint");
var response = await client.ExecuteAsync(request);
```

---

## Production Considerations

### Conditional Recording

Only enable recording in specific environments:

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddHttpClient("ApiClient", client =>
    {
        client.BaseAddress = new Uri("https://api.example.com");
    });

    // Only add recording in development/staging
    if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") != "Production")
    {
        services
            .AddHttpClient("ApiClient")
            .AddHttpRecorder("recordings/api-client");
    }
}
```

### Environment Variable Override

Use environment variables to control recording behavior without code changes:

```csharp
// The handler respects the HTTP_RECORDER_MODE environment variable
var handler = new HttpRecorderDelegatingHandler(
    "recordings/api",
    mode: HttpRecorderMode.Auto  // Can be overridden by environment variable
);

// Set environment variable:
// Windows: $env:HTTP_RECORDER_MODE="Replay"
// Linux/Mac: export HTTP_RECORDER_MODE="Replay"
```

### Performance Impact

HttpRecorder adds minimal overhead, but consider:

1. **Record Mode**: Serializes request/response to disk (slight overhead)
2. **Replay Mode**: No network calls, but deserialization overhead
3. **Passthrough Mode**: Minimal overhead, just passes through
4. **Disk I/O**: Ensure recordings directory is on fast storage

**Recommendations:**
- Use `Passthrough` mode in production
- Use `Auto` mode in development
- Use `Replay` mode in CI/CD pipelines

### Security

Always anonymize sensitive data when recording:

```csharp
var anonymizer = RulesInteractionAnonymizer.Default
    .AnonymizeRequestHeader("Authorization")
    .AnonymizeRequestHeader("X-Api-Key")
    .AnonymizeRequestHeader("Cookie")
    .AnonymizeResponseHeader("Set-Cookie")
    .AnonymizeRequestQueryStringParameter("api_key")
    .AnonymizeRequestQueryStringParameter("access_token")
    .AnonymizeRequestQueryStringParameter("password");

var handler = new HttpRecorderDelegatingHandler(
    "recordings/api",
    anonymizer: anonymizer
);
```

---

## HAR Archive Management

### Understanding HAR Files

HAR (HTTP Archive) files are JSON-based logs of HTTP transactions. They include:

- Complete request/response headers
- Request/response bodies
- Timing information
- Cookies and cache information

**Example HAR Structure:**

```json
{
  "log": {
    "version": "1.2",
    "creator": {
      "name": "HttpRecorder",
      "version": "1.0.0"
    },
    "entries": [
      {
        "startedDateTime": "2025-11-04T12:00:00.000Z",
        "time": 125,
        "request": {
          "method": "GET",
          "url": "https://api.example.com/users/123",
          "headers": [...]
        },
        "response": {
          "status": 200,
          "statusText": "OK",
          "headers": [...],
          "content": {...}
        }
      }
    ]
  }
}
```

### Viewing HAR Files

HAR files can be viewed in:

1. **Chrome DevTools**: Network tab → Right-click → "Save as HAR with content"
2. **Fiddler**: File → Import → HAR
3. **Charles Proxy**: File → Import
4. **Online HAR Viewer**: http://www.softwareishard.com/har/viewer/
5. **VS Code**: Install HAR viewer extensions

### Custom Repository Implementation

Implement custom storage for HAR files:

```csharp
using System.Threading;
using System.Threading.Tasks;
using HttpRecorder.Repositories;

public class DatabaseInteractionRepository : IInteractionRepository
{
    private readonly IDbContext _dbContext;

    public DatabaseInteractionRepository(IDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> ExistsAsync(string interactionName, CancellationToken cancellationToken)
    {
        return await _dbContext.Interactions
            .AnyAsync(i => i.Name == interactionName, cancellationToken);
    }

    public async Task<Interaction> LoadAsync(string interactionName, CancellationToken cancellationToken)
    {
        var record = await _dbContext.Interactions
            .FirstOrDefaultAsync(i => i.Name == interactionName, cancellationToken);
        
        if (record == null)
            throw new HttpRecorderException($"Interaction '{interactionName}' not found.");
        
        // Deserialize from database
        return JsonSerializer.Deserialize<Interaction>(record.Data);
    }

    public async Task<Interaction> StoreAsync(Interaction interaction, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(interaction);
        
        var existing = await _dbContext.Interactions
            .FirstOrDefaultAsync(i => i.Name == interaction.Name, cancellationToken);
        
        if (existing != null)
        {
            existing.Data = json;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _dbContext.Interactions.Add(new InteractionRecord
            {
                Name = interaction.Name,
                Data = json,
                CreatedAt = DateTime.UtcNow
            });
        }
        
        await _dbContext.SaveChangesAsync(cancellationToken);
        return interaction;
    }
}
```

---

## Best Practices

### 1. Organize Recordings by Feature

```
recordings/
├── authentication/
│   ├── login.har
│   └── refresh-token.har
├── users/
│   ├── get-user.har
│   ├── create-user.har
│   └── update-user.har
└── orders/
    ├── list-orders.har
    └── create-order.har
```

### 2. Use Meaningful Interaction Names

```csharp
// Good: descriptive names
var client = new HttpClient(new HttpRecorderDelegatingHandler(
    "recordings/github/get-user-octocat"
));

// Bad: generic names
var client = new HttpClient(new HttpRecorderDelegatingHandler(
    "recordings/test1"
));
```

### 3. Version Control Recordings

Commit HAR files to version control for:
- Reproducible tests
- API change tracking
- Documentation

Add to `.gitignore` for temporary recordings:
```
recordings/temp/
recordings/**/debug-*.har
```

### 4. Regular Cleanup

Implement automatic cleanup of old recordings:

```csharp
public static void CleanupOldRecordings(string recordingsPath, int maxAgeDays = 30)
{
    var cutoffDate = DateTime.Now.AddDays(-maxAgeDays);
    var directory = new DirectoryInfo(recordingsPath);
    
    foreach (var file in directory.GetFiles("*.har", SearchOption.AllDirectories))
    {
        if (file.LastWriteTime < cutoffDate)
        {
            file.Delete();
        }
    }
}
```

### 5. Test with Real and Recorded Data

```csharp
[Fact]
public async Task TestWithRealApi()
{
    var client = CreateHttpClient(HttpRecorderMode.Passthrough);
    await TestApiCall(client);
}

[Fact]
public async Task TestWithRecordedData()
{
    var client = CreateHttpClient(HttpRecorderMode.Replay);
    await TestApiCall(client);
}
```

### 6. Document Recording Configuration

```csharp
/// <summary>
/// Creates an HttpClient configured for recording API interactions.
/// 
/// Recording Configuration:
/// - Mode: Auto (records if no existing recording found)
/// - Anonymizer: Removes Authorization headers and api_key query params
/// - Matcher: Matches by HTTP method and full URI
/// </summary>
public static HttpClient CreateApiClient(string serviceName)
{
    var anonymizer = RulesInteractionAnonymizer.Default
        .AnonymizeRequestHeader("Authorization")
        .AnonymizeRequestQueryStringParameter("api_key");

    return new HttpClient(
        new HttpRecorderDelegatingHandler(
            $"recordings/{serviceName}",
            mode: HttpRecorderMode.Auto,
            anonymizer: anonymizer
        )
        {
            InnerHandler = new HttpClientHandler()
        });
}
```

---

## Conclusion

HttpRecorder provides a powerful, non-invasive way to record and replay HTTP interactions in .NET applications. Whether you're building integration tests, debugging API issues, or creating API documentation, HttpRecorder's HAR-based approach offers compatibility with industry-standard tools and formats.

For more examples and advanced scenarios, see:
- [README.md](../README.md) - Getting started guide
- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines

### Additional Resources

- [HAR 1.2 Spec](http://www.softwareishard.com/blog/har-12-spec/)
- [Chrome DevTools Network Reference](https://developer.chrome.com/docs/devtools/network/)
- [.NET HttpClient Best Practices](https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines)
