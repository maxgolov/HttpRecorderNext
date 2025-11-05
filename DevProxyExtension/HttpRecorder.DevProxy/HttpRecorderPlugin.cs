// Copyright (c) 2025 Max Golovanov <max.golovanov+github@gmail.com>
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using HttpRecorder.Repositories.HAR;
using Microsoft.Extensions.Logging;

namespace HttpRecorder.DevProxy;

/// <summary>
/// Dev Proxy plugin that uses HttpRecorder to capture HTTP traffic and save it as HAR files.
/// </summary>
public sealed class HttpRecorderPlugin : BasePlugin<HttpRecorderPluginConfiguration>
{
    private readonly ConcurrentDictionary<string, PendingInteraction> _pendingInteractions = new();
    private readonly HttpArchiveInteractionRepository _repository;
    private int _interactionCounter;

    public override string Name => nameof(HttpRecorderPlugin);

    public HttpRecorderPlugin()
    {
        _repository = new HttpArchiveInteractionRepository();
    }

    private class PendingInteraction
    {
        public required string Id { get; init; }
        public required HttpRequestMessage Request { get; init; }
        public required DateTimeOffset StartTime { get; init; }
    }

    public override Task BeforeRequestAsync(ProxyRequestArgs e)
    {
        if (!e.HasRequestUrlMatch(UrlsToWatch))
            return Task.CompletedTask;

        try
        {
            var interactionId = Interlocked.Increment(ref _interactionCounter).ToString();
            var requestMessage = CreateHttpRequestMessage(e.Session);
            var startTime = DateTimeOffset.UtcNow;

            var pending = new PendingInteraction
            {
                Id = interactionId,
                Request = requestMessage,
                StartTime = startTime
            };

            var key = $"{e.Session.HttpClient.Request.Method}:{e.Session.HttpClient.Request.RequestUri}";
            _pendingInteractions[key] = pending;

            Logger.LogInformation(
                "Recording request #{Id}: {Method} {Url}",
                interactionId,
                e.Session.HttpClient.Request.Method,
                e.Session.HttpClient.Request.RequestUri);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error recording request");
        }

        return Task.CompletedTask;
    }

    public override async Task AfterResponseAsync(ProxyResponseArgs e)
    {
        if (!e.HasRequestUrlMatch(UrlsToWatch))
            return;

        try
        {
            var key = $"{e.Session.HttpClient.Request.Method}:{e.Session.HttpClient.Request.RequestUri}";
            
            if (!_pendingInteractions.TryRemove(key, out var pending))
            {
                Logger.LogWarning("No matching request found for response from {Url}",
                    e.Session.HttpClient.Request.RequestUri);
                return;
            }

            var endTime = DateTimeOffset.UtcNow;
            var totalTime = endTime - pending.StartTime;

            // Create HttpResponseMessage
            var responseMessage = CreateHttpResponseMessage(e.Session, pending.Request);

            // Create InteractionMessage
            var timings = new InteractionMessageTimings(pending.StartTime, totalTime);
            var interactionMessage = new InteractionMessage(responseMessage, timings);

            // Create Interaction with full path
            var interactionName = SanitizeInteractionName(pending.Id, e.Session.HttpClient.Request);
            var filePath = await PrepareOutputFilePathAsync(interactionName);
            var interaction = new Interaction(filePath, new[] { interactionMessage });

            Logger.LogInformation(
                "Recording response: {StatusCode} for {Method} {Url}",
                e.Session.HttpResponse.Response.StatusCode,
                e.Session.HttpClient.Request.Method,
                e.Session.HttpClient.Request.RequestUri);

            // Save to HAR file
            await SaveInteractionAsync(interaction);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error recording response");
        }
    }

    private HttpRequestMessage CreateHttpRequestMessage(ProxySession session)
    {
        var proxyRequest = session.HttpClient.Request;
        var request = new HttpRequestMessage(new HttpMethod(proxyRequest.Method), proxyRequest.RequestUri);

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
        if (Configuration.IncludeBodies && proxyRequest.Body != null && proxyRequest.Body.Length > 0)
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

    private HttpResponseMessage CreateHttpResponseMessage(ProxySession session, HttpRequestMessage request)
    {
        var proxyResponse = session.HttpResponse.Response;
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
        if (Configuration.IncludeBodies && proxyResponse.Body != null && proxyResponse.Body.Length > 0)
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

    private static string SanitizeInteractionName(string id, ProxyRequest request)
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
}
