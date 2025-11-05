// Copyright (c) 2025 Max Golovanov <max.golovanov+github@gmail.com>
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Xunit.Abstractions;

namespace HttpRecorder.DevProxy.Tests;

/// <summary>
/// Functional tests for HttpRecorder Dev Proxy plugin.
/// </summary>
public class HttpRecorderPluginTests : IDisposable
{
    private readonly ITestOutputHelper _output;
    private readonly TestApiServer _server;
    private readonly string _recordingsPath;
    private readonly HttpRecorderPlugin _plugin;
    private readonly TestLogger _logger;

    public HttpRecorderPluginTests(ITestOutputHelper output)
    {
        _output = output;
        _server = new TestApiServer();
        _recordingsPath = Path.Combine(Path.GetTempPath(), $"devproxy-test-{Guid.NewGuid():N}");
        
        // Create recordings directory
        Directory.CreateDirectory(_recordingsPath);

        // Configure the plugin
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["HttpRecorderPlugin:outputDirectory"] = _recordingsPath,
                ["HttpRecorderPlugin:mode"] = "Record",
                ["HttpRecorderPlugin:includeBodies"] = "true",
                ["HttpRecorderPlugin:anonymizeSensitiveData"] = "true",
                ["HttpRecorderPlugin:sensitiveHeaders:0"] = "Authorization",
                ["HttpRecorderPlugin:sensitiveHeaders:1"] = "X-API-Key"
            })
            .Build();

        _logger = new TestLogger(output);
        _plugin = new HttpRecorderPlugin();
        _plugin.Initialize(configuration, _logger, new[] { _server.BaseUrl });

        _output.WriteLine($"Test API Server running at: {_server.BaseUrl}");
        _output.WriteLine($"Recordings will be saved to: {_recordingsPath}");
    }

    [Fact]
    public async Task Plugin_Should_Record_GET_Request_And_Response()
    {
        // Arrange
        var requestUri = new Uri($"{_server.BaseUrl}/api/test");
        var (requestArgs, responseArgs) = CreateProxySessionArgs("GET", requestUri, null, 200, "application/json", "{\"message\":\"Hello\"}");

        // Act - Simulate Dev Proxy intercepting request and response
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        // Wait a moment for async file operations
        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty("HAR file should be created");
        
        var harFile = harFiles[0];
        _output.WriteLine($"HAR file created: {harFile}");
        
        File.Exists(harFile).Should().BeTrue();
        
        var harContent = await File.ReadAllTextAsync(harFile);
        harContent.Should().Contain("GET");
        harContent.Should().Contain("/api/test");
        
        _output.WriteLine($"HAR Content Length: {harContent.Length} bytes");
    }

    [Fact]
    public async Task Plugin_Should_Record_POST_Request_With_Body()
    {
        // Arrange
        var requestUri = new Uri($"{_server.BaseUrl}/api/data");
        var requestBody = Encoding.UTF8.GetBytes("{\"name\":\"test\",\"value\":123}");
        var responseBody = "{\"received\":true}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "POST", 
            requestUri, 
            requestBody, 
            200, 
            "application/json", 
            responseBody,
            "application/json");

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("POST");
        harContent.Should().Contain("/api/data");
        harContent.Should().Contain("application/json");
        
        _output.WriteLine($"POST request recorded with body size: {requestBody.Length} bytes");
    }

    [Fact]
    public async Task Plugin_Should_Anonymize_Sensitive_Headers()
    {
        // Arrange
        var requestUri = new Uri($"{_server.BaseUrl}/api/users/1");
        var (requestArgs, responseArgs) = CreateProxySessionArgs("GET", requestUri, null, 200, "application/json", "{\"id\":1}");
        
        // Add sensitive headers
        requestArgs.Session.HttpClient.Request.Headers.Add(new ProxyHeader 
        { 
            Name = "Authorization", 
            Value = "Bearer secret-token-12345" 
        });
        requestArgs.Session.HttpClient.Request.Headers.Add(new ProxyHeader 
        { 
            Name = "X-API-Key", 
            Value = "super-secret-api-key" 
        });

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().NotContain("secret-token-12345", "sensitive token should be redacted");
        harContent.Should().NotContain("super-secret-api-key", "sensitive API key should be redacted");
        harContent.Should().Contain("***REDACTED***");
        
        _output.WriteLine("Sensitive headers were successfully anonymized");
    }

    [Fact]
    public async Task Plugin_Should_Handle_Multiple_Requests()
    {
        // Arrange & Act - Record multiple requests
        for (int i = 1; i <= 3; i++)
        {
            var requestUri = new Uri($"{_server.BaseUrl}/api/users/{i}");
            var responseBody = $"{{\"id\":{i},\"name\":\"User{i}\"}}";
            var (requestArgs, responseArgs) = CreateProxySessionArgs("GET", requestUri, null, 200, "application/json", responseBody);

            await _plugin.BeforeRequestAsync(requestArgs);
            await _plugin.AfterResponseAsync(responseArgs);
        }

        await Task.Delay(1000);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().HaveCount(3, "should record 3 separate interactions");
        
        _output.WriteLine($"Successfully recorded {harFiles.Length} interactions");
    }

    [Fact]
    public async Task Plugin_Should_Skip_Unmatched_URLs()
    {
        // Arrange - Request to URL not in urlsToWatch
        var unmatchedUri = new Uri("https://example.com/api/other");
        var (requestArgs, responseArgs) = CreateProxySessionArgs("GET", unmatchedUri, null, 200, "text/plain", "OK");

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().BeEmpty("should not record unmatched URLs");
        
        _output.WriteLine("Correctly skipped unmatched URL");
    }

    private (ProxyRequestArgs, ProxyResponseArgs) CreateProxySessionArgs(
        string method,
        Uri requestUri,
        byte[]? requestBody,
        int statusCode,
        string? responseContentType,
        string responseBody,
        string? requestContentType = null)
    {
        var requestHeaders = new List<ProxyHeader>
        {
            new() { Name = "Host", Value = requestUri.Host },
            new() { Name = "User-Agent", Value = "HttpRecorderPluginTests/1.0" }
        };

        if (requestContentType != null && requestBody != null)
        {
            requestHeaders.Add(new ProxyHeader { Name = "Content-Type", Value = requestContentType });
            requestHeaders.Add(new ProxyHeader { Name = "Content-Length", Value = requestBody.Length.ToString() });
        }

        var responseHeaders = new List<ProxyHeader>
        {
            new() { Name = "Date", Value = DateTime.UtcNow.ToString("R") },
            new() { Name = "Server", Value = "TestServer/1.0" }
        };

        if (responseContentType != null)
        {
            responseHeaders.Add(new ProxyHeader { Name = "Content-Type", Value = responseContentType });
        }

        var responseBodyBytes = Encoding.UTF8.GetBytes(responseBody);

        var session = new ProxySession
        {
            HttpClient = new ProxyHttpClient
            {
                Request = new ProxyRequest
                {
                    RequestUri = requestUri,
                    Method = method,
                    Headers = requestHeaders,
                    Body = requestBody
                }
            },
            HttpResponse = new ProxyHttpResponse
            {
                Response = new ProxyResponse
                {
                    StatusCode = statusCode,
                    Headers = responseHeaders,
                    Body = responseBodyBytes
                }
            }
        };

        var requestArgs = new ProxyRequestArgs { Session = session };
        var responseArgs = new ProxyResponseArgs { Session = session };

        return (requestArgs, responseArgs);
    }

    public void Dispose()
    {
        _server.Dispose();
        
        // Clean up recordings directory
        try
        {
            if (Directory.Exists(_recordingsPath))
            {
                Directory.Delete(_recordingsPath, true);
                _output.WriteLine($"Cleaned up recordings directory: {_recordingsPath}");
            }
        }
        catch (Exception ex)
        {
            _output.WriteLine($"Warning: Could not clean up recordings directory: {ex.Message}");
        }
    }

    private class TestLogger : ILogger
    {
        private readonly ITestOutputHelper _output;

        public TestLogger(ITestOutputHelper output)
        {
            _output = output;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var message = formatter(state, exception);
            _output.WriteLine($"[{logLevel}] {message}");
            if (exception != null)
            {
                _output.WriteLine($"Exception: {exception}");
            }
        }
    }
}
