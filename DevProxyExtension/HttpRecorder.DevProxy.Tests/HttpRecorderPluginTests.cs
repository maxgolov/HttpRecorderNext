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

    [Fact]
    public async Task Plugin_Should_Handle_GET_Request_Without_Body()
    {
        // Arrange - GET requests should NEVER have request body
        var requestUri = new Uri($"{_server.BaseUrl}/api/items");
        var (requestArgs, responseArgs) = CreateProxySessionArgs("GET", requestUri, null, 200, "application/json", "{\"items\":[]}");

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("GET");
        harContent.Should().NotContain("\"postData\"", "GET requests should not have postData");
        
        _output.WriteLine("GET request correctly recorded without request body");
    }

    [Fact]
    public async Task Plugin_Should_Handle_HEAD_Request_Without_Bodies()
    {
        // Arrange - HEAD requests have NO request body and NO response body
        var requestUri = new Uri($"{_server.BaseUrl}/api/resource");
        var (requestArgs, responseArgs) = CreateProxySessionArgs("HEAD", requestUri, null, 200, null, "");

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("HEAD");
        harContent.Should().NotContain("\"postData\"", "HEAD requests should not have postData");
        
        _output.WriteLine("HEAD request correctly recorded without any body");
    }

    [Fact]
    public async Task Plugin_Should_Handle_POST_Request_With_JSON_Body()
    {
        // Arrange - POST with JSON body
        var requestUri = new Uri($"{_server.BaseUrl}/api/users");
        var requestBody = Encoding.UTF8.GetBytes("{\"name\":\"John Doe\",\"email\":\"john@example.com\"}");
        var responseBody = "{\"id\":123,\"created\":true}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "POST", 
            requestUri, 
            requestBody, 
            201, 
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
        harContent.Should().Contain("\"postData\"", "POST requests should have postData");
        harContent.Should().Contain("application/json");
        
        _output.WriteLine("POST request with JSON body correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_POST_Request_With_Form_Data()
    {
        // Arrange - POST with form-urlencoded body
        var requestUri = new Uri($"{_server.BaseUrl}/api/login");
        var requestBody = Encoding.UTF8.GetBytes("username=admin&password=secret123");
        var responseBody = "{\"token\":\"abc123\"}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "POST", 
            requestUri, 
            requestBody, 
            200, 
            "application/json", 
            responseBody,
            "application/x-www-form-urlencoded");

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("POST");
        harContent.Should().Contain("application/x-www-form-urlencoded");
        
        _output.WriteLine("POST request with form data correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_PUT_Request_With_Body()
    {
        // Arrange - PUT with JSON body
        var requestUri = new Uri($"{_server.BaseUrl}/api/users/123");
        var requestBody = Encoding.UTF8.GetBytes("{\"name\":\"Jane Doe\",\"email\":\"jane@example.com\"}");
        var responseBody = "{\"id\":123,\"updated\":true}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "PUT", 
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
        harContent.Should().Contain("PUT");
        harContent.Should().Contain("\"postData\"", "PUT requests should have postData");
        
        _output.WriteLine("PUT request with body correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_PATCH_Request_With_Body()
    {
        // Arrange - PATCH with JSON body
        var requestUri = new Uri($"{_server.BaseUrl}/api/users/123");
        var requestBody = Encoding.UTF8.GetBytes("{\"email\":\"newemail@example.com\"}");
        var responseBody = "{\"id\":123,\"patched\":true}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "PATCH", 
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
        harContent.Should().Contain("PATCH");
        harContent.Should().Contain("\"postData\"", "PATCH requests should have postData");
        
        _output.WriteLine("PATCH request with body correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_DELETE_Request_Without_Body()
    {
        // Arrange - DELETE typically has no request body
        var requestUri = new Uri($"{_server.BaseUrl}/api/users/123");
        var responseBody = "{\"deleted\":true}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "DELETE", 
            requestUri, 
            null, 
            200, 
            "application/json", 
            responseBody);

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("DELETE");
        
        _output.WriteLine("DELETE request without body correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_DELETE_Request_With_Body()
    {
        // Arrange - DELETE with body (some APIs use this)
        var requestUri = new Uri($"{_server.BaseUrl}/api/users/batch");
        var requestBody = Encoding.UTF8.GetBytes("{\"ids\":[1,2,3,4,5]}");
        var responseBody = "{\"deleted\":5}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "DELETE", 
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
        harContent.Should().Contain("DELETE");
        harContent.Should().Contain("\"postData\"", "DELETE requests with body should have postData");
        
        _output.WriteLine("DELETE request with body correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_OPTIONS_Request()
    {
        // Arrange - OPTIONS request (CORS preflight)
        var requestUri = new Uri($"{_server.BaseUrl}/api/users");
        var responseHeaders = new List<ProxyHeader>
        {
            new() { Name = "Allow", Value = "GET, POST, PUT, DELETE, OPTIONS" },
            new() { Name = "Access-Control-Allow-Methods", Value = "GET, POST, PUT, DELETE" },
            new() { Name = "Access-Control-Allow-Headers", Value = "Content-Type, Authorization" }
        };
        
        var (requestArgs, responseArgs) = CreateProxySessionArgs("OPTIONS", requestUri, null, 204, null, "");
        
        // Add CORS headers to response
        foreach (var header in responseHeaders)
        {
            responseArgs.Session.HttpResponse.Response.Headers.Add(header);
        }

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("OPTIONS");
        harContent.Should().NotContain("\"postData\"", "OPTIONS requests should not have postData");
        
        _output.WriteLine("OPTIONS request correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_TRACE_Request()
    {
        // Arrange - TRACE request (diagnostic method)
        var requestUri = new Uri($"{_server.BaseUrl}/api/debug");
        var responseBody = "TRACE /api/debug HTTP/1.1\r\nHost: localhost\r\n";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "TRACE", 
            requestUri, 
            null, 
            200, 
            "message/http", 
            responseBody);

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("TRACE");
        harContent.Should().NotContain("\"postData\"", "TRACE requests should not have postData");
        
        _output.WriteLine("TRACE request correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_Large_Response_Body()
    {
        // Arrange - Large response body (1MB)
        var requestUri = new Uri($"{_server.BaseUrl}/api/large-file");
        var largeResponseBody = new string('X', 1024 * 1024); // 1MB of X's
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "GET", 
            requestUri, 
            null, 
            200, 
            "text/plain", 
            largeResponseBody);

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(1000);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Length.Should().BeGreaterThan(1024 * 1024, "HAR file should contain large response");
        
        _output.WriteLine($"Large response body correctly recorded (HAR size: {harContent.Length} bytes)");
    }

    [Fact]
    public async Task Plugin_Should_Handle_Binary_Content_Response()
    {
        // Arrange - Binary content (simulated image)
        var requestUri = new Uri($"{_server.BaseUrl}/api/image.png");
        var binaryData = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }; // PNG header
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "GET", 
            requestUri, 
            null, 
            200, 
            "image/png", 
            Convert.ToBase64String(binaryData));

        // Override response body with actual binary
        responseArgs.Session.HttpResponse.Response.Body = binaryData;

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("image/png");
        
        _output.WriteLine("Binary content response correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_Empty_Response_Body()
    {
        // Arrange - 204 No Content response
        var requestUri = new Uri($"{_server.BaseUrl}/api/action");
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "POST", 
            requestUri, 
            Encoding.UTF8.GetBytes("{\"action\":\"ping\"}"), 
            204, 
            null, 
            "",
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
        harContent.Should().Contain("204");
        
        _output.WriteLine("Empty response body (204 No Content) correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_Query_Parameters()
    {
        // Arrange - GET with query parameters
        var requestUri = new Uri($"{_server.BaseUrl}/api/search?q=test&limit=10&offset=0");
        var responseBody = "{\"results\":[],\"total\":0}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "GET", 
            requestUri, 
            null, 
            200, 
            "application/json", 
            responseBody);

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("search");
        harContent.Should().Contain("queryString", "Query parameters should be recorded");
        
        _output.WriteLine("Query parameters correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_Error_Response_Codes()
    {
        // Arrange - 404 Not Found
        var requestUri = new Uri($"{_server.BaseUrl}/api/nonexistent");
        var responseBody = "{\"error\":\"Not Found\",\"code\":404}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "GET", 
            requestUri, 
            null, 
            404, 
            "application/json", 
            responseBody);

        // Act
        await _plugin.BeforeRequestAsync(requestArgs);
        await _plugin.AfterResponseAsync(responseArgs);

        await Task.Delay(500);

        // Assert
        var harFiles = Directory.GetFiles(_recordingsPath, "*.har");
        harFiles.Should().NotBeEmpty();
        
        var harContent = await File.ReadAllTextAsync(harFiles[0]);
        harContent.Should().Contain("404");
        harContent.Should().Contain("Not Found");
        
        _output.WriteLine("Error response (404) correctly recorded");
    }

    [Fact]
    public async Task Plugin_Should_Handle_Server_Error_Response()
    {
        // Arrange - 500 Internal Server Error
        var requestUri = new Uri($"{_server.BaseUrl}/api/crash");
        var responseBody = "{\"error\":\"Internal Server Error\",\"message\":\"Database connection failed\"}";
        var (requestArgs, responseArgs) = CreateProxySessionArgs(
            "POST", 
            requestUri, 
            Encoding.UTF8.GetBytes("{\"test\":true}"), 
            500, 
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
        harContent.Should().Contain("500");
        
        _output.WriteLine("Server error response (500) correctly recorded");
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
