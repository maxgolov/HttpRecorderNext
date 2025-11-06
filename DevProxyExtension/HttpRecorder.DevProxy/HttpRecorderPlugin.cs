// Copyright (c) 2025 Max Golovanov <max.golovanov+github@gmail.com>
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DevProxy.Abstractions.Plugins;
using DevProxy.Abstractions.Proxy;
using DevProxy.Abstractions.Utils;
using HttpRecorder.Repositories.HAR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Titanium.Web.Proxy.EventArguments;

namespace HttpRecorder.DevProxy;

/// <summary>
/// Dev Proxy plugin that uses HttpRecorder to capture HTTP traffic and save it as HAR files.
/// </summary>
public sealed class HttpRecorderPlugin(
    HttpClient httpClient,
    ILogger<HttpRecorderPlugin> logger,
    ISet<UrlToWatch> urlsToWatch,
    IProxyConfiguration proxyConfiguration,
    IConfigurationSection configurationSection)
    : BasePlugin<HttpRecorderPluginConfiguration>(httpClient, logger, urlsToWatch, proxyConfiguration, configurationSection)
{
    private readonly ConcurrentDictionary<string, PendingInteraction> _pendingInteractions = new();
    private readonly HttpArchiveInteractionRepository _repository = new();
    private readonly object _lock = new();
    private int _interactionCounter;
    private string? _sessionFileName;
    private StreamWriter? _harFileWriter;
    private bool _firstEntry = true;

    public override string Name => nameof(HttpRecorderPlugin);

    private class PendingInteraction
    {
        public required string Id { get; init; }
        public required HttpRequestMessage Request { get; init; }
        public required DateTimeOffset StartTime { get; init; }
    }

    /// <summary>
    /// Generate a DJB2 hash for request matching
    /// </summary>
    private static string GenerateRequestKey(Titanium.Web.Proxy.Http.Request request, int sessionHashCode)
    {
        // Use DJB2 hash algorithm for reliable matching
        // Combine: Method + URL + Session for uniqueness
        var keyString = $"{request.Method}|{request.RequestUri}|{sessionHashCode}";
        
        ulong hash = 5381;
        foreach (char c in keyString)
        {
            hash = ((hash << 5) + hash) + c; // hash * 33 + c
        }
        
        return hash.ToString("X16"); // Return as hex string
    }

    public override Task BeforeRequestAsync(ProxyRequestArgs e, CancellationToken cancellationToken)
    {
        if (!e.HasRequestUrlMatch(UrlsToWatch))
            return Task.CompletedTask;

        try
        {
            Logger.LogInformation("BeforeRequest: Processing {Method} {Url}", 
                e.Session.HttpClient.Request.Method,
                e.Session.HttpClient.Request.RequestUri);

            var interactionId = Interlocked.Increment(ref _interactionCounter).ToString();
            var requestMessage = CreateHttpRequestMessage(e.Session);
            var startTime = DateTimeOffset.UtcNow;

            var pending = new PendingInteraction
            {
                Id = interactionId,
                Request = requestMessage,
                StartTime = startTime
            };

            // Use DJB2 hash for unique request identification
            var key = GenerateRequestKey(e.Session.HttpClient.Request, e.Session.GetHashCode());
            _pendingInteractions[key] = pending;
            Logger.LogInformation("Stored pending request #{Id} with key {Key}", interactionId, key);

            Logger.LogInformation(
                "Recording request #{Id}: {Method} {Url}",
                interactionId,
                e.Session.HttpClient.Request.Method,
                e.Session.HttpClient.Request.RequestUri);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error recording request: {Message}", ex.Message);
            throw; // Re-throw to make error visible in Dev Proxy
        }

        return Task.CompletedTask;
    }

    public override async Task AfterResponseAsync(ProxyResponseArgs e, CancellationToken cancellationToken)
    {
        if (!e.HasRequestUrlMatch(UrlsToWatch))
            return;

        try
        {
            Logger.LogInformation("AfterResponse: Processing {Method} {Url} - Status {StatusCode}", 
                e.Session.HttpClient.Request.Method,
                e.Session.HttpClient.Request.RequestUri,
                e.Session.HttpClient.Response.StatusCode);

            // Use DJB2 hash to match request
            var key = GenerateRequestKey(e.Session.HttpClient.Request, e.Session.GetHashCode());
            
            if (!_pendingInteractions.TryRemove(key, out var pending))
            {
                Logger.LogWarning("No matching request found for response from {Url} (key: {Key}). Pending count: {Count}",
                    e.Session.HttpClient.Request.RequestUri, key, _pendingInteractions.Count);
                return;
            }

            Logger.LogInformation("Found matching request #{Id} for response", pending.Id);

            var endTime = DateTimeOffset.UtcNow;
            var totalTime = endTime - pending.StartTime;

            Logger.LogInformation("Creating HttpResponseMessage...");

            // Create HttpResponseMessage
            var responseMessage = CreateHttpResponseMessage(e.Session, pending.Request);

            Logger.LogInformation("Creating InteractionMessage...");

            // Create InteractionMessage
            var timings = new InteractionMessageTimings(pending.StartTime, totalTime);
            var interactionMessage = new InteractionMessage(responseMessage, timings);

            Logger.LogInformation("Writing to HAR file...");

            // Write to HAR file immediately
            await WriteEntryToHarAsync(interactionMessage, cancellationToken);

            Logger.LogInformation(
                "Recorded request #{Count}: {StatusCode} for {Method} {Url}",
                _interactionCounter,
                e.Session.HttpClient.Response.StatusCode,
                e.Session.HttpClient.Request.Method,
                e.Session.HttpClient.Request.RequestUri);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error recording response: {Message} - Stack: {Stack}", ex.Message, ex.StackTrace);
            throw; // Re-throw to make error visible in Dev Proxy
        }
    }

    private HttpRequestMessage CreateHttpRequestMessage(SessionEventArgs session)
    {
        var proxyRequest = session.HttpClient.Request;
        var request = new HttpRequestMessage(new HttpMethod(proxyRequest.Method ?? "GET"), proxyRequest.RequestUri);

        // Copy headers
        foreach (var header in proxyRequest.Headers)
        {
            // Skip sensitive headers if anonymization is enabled
            if (Configuration.AnonymizeSensitiveData &&
                Configuration.SensitiveHeaders.Contains(header.Name, StringComparer.OrdinalIgnoreCase))
            {
                request.Headers.TryAddWithoutValidation(header.Name, "***REDACTED***");
            }
            else
            {
                request.Headers.TryAddWithoutValidation(header.Name, header.Value);
            }
        }

        // Add body if available and configured
        // Only add content for methods that support request bodies (POST, PUT, PATCH, DELETE)
        // Never add content for GET, HEAD, OPTIONS, TRACE
        var methodSupportsBody = !string.Equals(proxyRequest.Method, "GET", StringComparison.OrdinalIgnoreCase) &&
                                  !string.Equals(proxyRequest.Method, "HEAD", StringComparison.OrdinalIgnoreCase) &&
                                  !string.Equals(proxyRequest.Method, "OPTIONS", StringComparison.OrdinalIgnoreCase) &&
                                  !string.Equals(proxyRequest.Method, "TRACE", StringComparison.OrdinalIgnoreCase);
        
        if (Configuration.IncludeBodies && methodSupportsBody && proxyRequest.Body != null && proxyRequest.Body.Length > 0)
        {
            request.Content = new ByteArrayContent(proxyRequest.Body);
            
            // Try to preserve Content-Type header
            var contentTypeHeader = proxyRequest.Headers.FirstOrDefault(h => 
                h.Name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase));
            if (contentTypeHeader != null)
            {
                request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentTypeHeader.Value);
            }
        }

        return request;
    }

    private HttpResponseMessage CreateHttpResponseMessage(SessionEventArgs session, HttpRequestMessage request)
    {
        var proxyResponse = session.HttpClient.Response;
        var response = new HttpResponseMessage((System.Net.HttpStatusCode)proxyResponse.StatusCode)
        {
            RequestMessage = request
        };

        // Copy headers
        foreach (var header in proxyResponse.Headers)
        {
            // Skip sensitive headers if anonymization is enabled
            if (Configuration.AnonymizeSensitiveData &&
                Configuration.SensitiveHeaders.Contains(header.Name, StringComparer.OrdinalIgnoreCase))
            {
                response.Headers.TryAddWithoutValidation(header.Name, "***REDACTED***");
            }
            else
            {
                response.Headers.TryAddWithoutValidation(header.Name, header.Value);
            }
        }

        // Add body if available and configured
        // Only add content for:
        // - Methods that support response bodies (not HEAD)
        // - Status codes that can have content (not 204 No Content, 304 Not Modified, 1xx informational)
        var requestMethod = session.HttpClient.Request.Method ?? "GET";
        var statusCode = proxyResponse.StatusCode;
        var methodSupportsBody = !string.Equals(requestMethod, "HEAD", StringComparison.OrdinalIgnoreCase);
        var statusSupportsBody = statusCode != 204 &&  // No Content
                                  statusCode != 304 &&  // Not Modified
                                  (statusCode < 100 || statusCode >= 200);  // Not 1xx informational
        
        if (Configuration.IncludeBodies && methodSupportsBody && statusSupportsBody && 
            proxyResponse.Body != null && proxyResponse.Body.Length > 0)
        {
            response.Content = new ByteArrayContent(proxyResponse.Body);
            
            // Try to preserve Content-Type header
            var contentTypeHeader = proxyResponse.Headers.FirstOrDefault(h => 
                h.Name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase));
            if (contentTypeHeader != null)
            {
                response.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentTypeHeader.Value);
            }
        }

        return response;
    }

    private Task<string> PrepareOutputFilePathAsync(string interactionName)
    {
        // Ensure output directory exists
        var outputDir = Configuration.OutputDirectory;
        if (!Directory.Exists(outputDir))
        {
            Directory.CreateDirectory(outputDir);
        }

        // Return full path
        return Task.FromResult(Path.Combine(outputDir, interactionName));
    }

    private async Task SaveInteractionAsync(Interaction interaction)
    {
        try
        {
            // Store the interaction using the repository
            // The interaction.Name already contains the full path
            await _repository.StoreAsync(interaction, CancellationToken.None);

            Logger.LogInformation("Saved HAR recording: {InteractionName}", Path.GetFileNameWithoutExtension(interaction.Name));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error saving HAR file for {InteractionName}", interaction.Name);
        }
    }

    private static string SanitizeInteractionName(string id, Titanium.Web.Proxy.Http.Request request)
    {
        try
        {
            var uri = new Uri(request.RequestUri.ToString());
            var pathAndQuery = uri.AbsolutePath + uri.Query;
            
            // Remove invalid filename characters
            var invalid = Path.GetInvalidFileNameChars();
            var sanitized = string.Join("_", pathAndQuery.Split(invalid));
            
            // Limit length
            if (sanitized.Length > 50)
            {
                sanitized = sanitized.Substring(0, 50);
            }

            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss");
            return $"{timestamp}_{id}_{request.Method}_{sanitized.Trim('_')}";
        }
        catch
        {
            return $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{id}_{request.Method}_request";
        }
    }

    public override async Task InitializeAsync(InitArgs e, CancellationToken cancellationToken)
    {
        await base.InitializeAsync(e, cancellationToken);
        _sessionFileName = $"session_{DateTime.UtcNow:yyyyMMdd_HHmmss}";
        await InitializeHarFileAsync(cancellationToken);
        Logger.LogInformation("Started recording session: {SessionName}", _sessionFileName);
    }

    public override async Task AfterRecordingStopAsync(RecordingArgs e, CancellationToken cancellationToken)
    {
        Logger.LogInformation("AfterRecordingStopAsync called - closing HAR file");
        await CloseHarFileAsync();
    }

    // Ensure cleanup happens even if AfterRecordingStop isn't called
    ~HttpRecorderPlugin()
    {
        try
        {
            CloseHarFileAsync().GetAwaiter().GetResult();
        }
        catch
        {
            // Ignore errors in finalizer
        }
    }

    private async Task InitializeHarFileAsync(CancellationToken cancellationToken)
    {
        try
        {
            var sessionName = _sessionFileName ?? $"session_{DateTime.UtcNow:yyyyMMdd_HHmmss}";
            var filePath = await PrepareOutputFilePathAsync(sessionName);
            var fullPath = Path.HasExtension(filePath) ? filePath : $"{filePath}.har";

            // Use larger buffer with read sharing enabled for live preview
            var fileStream = new FileStream(
                fullPath,
                FileMode.Create,
                FileAccess.Write,
                FileShare.Read,  // Allow readers (e.g., preview) while writing
                bufferSize: 65536,  // 64KB buffer instead of default 4KB
                useAsync: true);
            
            _harFileWriter = new StreamWriter(fileStream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            
            // Write HAR file header
            await _harFileWriter.WriteLineAsync("{");
            await _harFileWriter.WriteLineAsync("  \"log\": {");
            await _harFileWriter.WriteLineAsync("    \"version\": \"1.2\",");
            await _harFileWriter.WriteLineAsync("    \"creator\": {");
            await _harFileWriter.WriteLineAsync("      \"name\": \"HttpRecorder\",");
            await _harFileWriter.WriteLineAsync("      \"version\": \"0.1.0\"");
            await _harFileWriter.WriteLineAsync("    },");
            await _harFileWriter.WriteLineAsync("    \"entries\": [");
            await _harFileWriter.FlushAsync();

            Logger.LogInformation("Initialized HAR file: {FilePath}", fullPath.Replace("\\", "/"));
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error initializing HAR file");
        }
    }

    private async Task WriteEntryToHarAsync(InteractionMessage message, CancellationToken cancellationToken)
    {
        if (_harFileWriter == null)
            return;

        try
        {
            // Create HAR entry from InteractionMessage
            Entry entry;
            try
            {
                entry = new Entry(message);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error creating HAR entry from InteractionMessage. Request: {RequestUri}, Response: {StatusCode}",
                    message.Response?.RequestMessage?.RequestUri,
                    message.Response?.StatusCode);
                throw;
            }

            var entryJson = JsonSerializer.Serialize(entry, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false,  // Don't indent here, we'll handle indentation properly
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            });

            // Parse and re-serialize with proper indentation to avoid corrupting escape sequences
            var jsonDoc = JsonDocument.Parse(entryJson);
            using var stream = new MemoryStream();
            using var writer = new Utf8JsonWriter(stream, new JsonWriterOptions 
            { 
                Indented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            });
            
            jsonDoc.WriteTo(writer);
            await writer.FlushAsync();
            
            var formattedJson = Encoding.UTF8.GetString(stream.ToArray());
            
            // Indent each line (this is safe because JSON is already properly escaped)
            var indentedLines = formattedJson.Split('\n').Select(line => "      " + line);
            var indentedJson = string.Join('\n', indentedLines);

            // ATOMIC WRITE: Lock and flush together to prevent race conditions
            lock (_lock)
            {
                // Add comma before entry if not first
                if (!_firstEntry)
                {
                    _harFileWriter.Write(",\n");  // Synchronous write under lock
                }
                _firstEntry = false;

                // Write the entry synchronously
                _harFileWriter.Write(indentedJson);
                
                // CRITICAL: Flush atomically under lock to ensure data integrity
                _harFileWriter.Flush();
            }
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error writing HAR entry");
            throw; // Re-throw to make the error visible in Dev Proxy
        }
    }

    private async Task CloseHarFileAsync()
    {
        if (_harFileWriter == null)
            return;

        try
        {
            // Close the entries array and HAR file
            await _harFileWriter.WriteLineAsync();
            await _harFileWriter.WriteLineAsync("    ]");
            await _harFileWriter.WriteLineAsync("  }");
            await _harFileWriter.WriteLineAsync("}");
            
            // CRITICAL: Force flush before closing
            await _harFileWriter.FlushAsync();
            
            // Close and dispose the writer
            _harFileWriter.Close();
            await _harFileWriter.DisposeAsync();
            _harFileWriter = null;

            Logger.LogInformation(
                "Closed HAR file: {SessionName} ({EntryCount} entries)",
                _sessionFileName,
                _interactionCounter);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error closing HAR file");
        }
    }
}
