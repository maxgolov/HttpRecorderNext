// Copyright (c) 2025 Max Golovanov <max.golovanov+github@gmail.com>
// Licensed under the MIT License. See LICENSE file in the project root for full license information.
// 
// This is a stub implementation for Dev Proxy BasePlugin.
// In a real scenario, you would reference DevProxy.Abstractions.dll from the Dev Proxy installation.

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HttpRecorder.DevProxy;

/// <summary>
/// Base class for Dev Proxy plugins with configuration support.
/// This is a stub - replace with actual DevProxy.Abstractions reference when available.
/// </summary>
/// <typeparam name="TConfiguration">Configuration type.</typeparam>
public abstract class BasePlugin<TConfiguration>
    where TConfiguration : class, new()
{
    /// <summary>
    /// Gets the plugin name.
    /// </summary>
    public abstract string Name { get; }

    /// <summary>
    /// Gets the logger.
    /// </summary>
    protected ILogger Logger { get; private set; } = null!;

    /// <summary>
    /// Gets the plugin configuration.
    /// </summary>
    protected TConfiguration Configuration { get; private set; } = null!;

    /// <summary>
    /// Gets the URLs to watch.
    /// </summary>
    protected string[] UrlsToWatch { get; private set; } = Array.Empty<string>();

    /// <summary>
    /// Initializes the plugin.
    /// </summary>
    public virtual void Initialize(IConfiguration configuration, ILogger logger, string[] urlsToWatch)
    {
        Logger = logger;
        UrlsToWatch = urlsToWatch;
        
        var configSection = configuration.GetSection(Name);
        Configuration = configSection.Get<TConfiguration>() ?? new TConfiguration();
    }

    /// <summary>
    /// Called before a request is sent.
    /// </summary>
    public virtual Task BeforeRequestAsync(ProxyRequestArgs e)
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// Called after a response is received.
    /// </summary>
    public virtual Task AfterResponseAsync(ProxyResponseArgs e)
    {
        return Task.CompletedTask;
    }
}

/// <summary>
/// Proxy request event arguments.
/// </summary>
public class ProxyRequestArgs
{
    public required ProxySession Session { get; init; }

    public bool HasRequestUrlMatch(string[] urlsToWatch)
    {
        if (urlsToWatch.Length == 0)
            return true;

        var requestUrl = Session.HttpClient.Request.RequestUri.ToString();
        return urlsToWatch.Any(pattern => requestUrl.Contains(pattern, StringComparison.OrdinalIgnoreCase));
    }
}

/// <summary>
/// Proxy response event arguments.
/// </summary>
public class ProxyResponseArgs
{
    public required ProxySession Session { get; init; }

    public bool HasRequestUrlMatch(string[] urlsToWatch)
    {
        if (urlsToWatch.Length == 0)
            return true;

        var requestUrl = Session.HttpClient.Request.RequestUri.ToString();
        return urlsToWatch.Any(pattern => requestUrl.Contains(pattern, StringComparison.OrdinalIgnoreCase));
    }
}

/// <summary>
/// Proxy session information.
/// </summary>
public class ProxySession
{
    public required ProxyHttpClient HttpClient { get; init; }
    public required ProxyHttpResponse HttpResponse { get; init; }
}

/// <summary>
/// Proxy HTTP client information.
/// </summary>
public class ProxyHttpClient
{
    public required ProxyRequest Request { get; init; }
}

/// <summary>
/// Proxy HTTP response information.
/// </summary>
public class ProxyHttpResponse
{
    public required ProxyResponse Response { get; init; }
}

/// <summary>
/// Proxy request information.
/// </summary>
public class ProxyRequest
{
    public required Uri RequestUri { get; init; }
    public required string Method { get; init; }
    public required List<ProxyHeader> Headers { get; init; }
    public byte[]? Body { get; set; }
}

/// <summary>
/// Proxy response information.
/// </summary>
public class ProxyResponse
{
    public required int StatusCode { get; init; }
    public required List<ProxyHeader> Headers { get; init; }
    public byte[]? Body { get; set; }
}

/// <summary>
/// HTTP header.
/// </summary>
public class ProxyHeader
{
    public required string Name { get; init; }
    public required string Value { get; init; }
}
