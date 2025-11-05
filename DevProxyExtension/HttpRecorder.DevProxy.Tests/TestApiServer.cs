// Copyright (c) 2025 Max Golovanov <max.golovanov+github@gmail.com>
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HttpRecorder.DevProxy.Tests;

/// <summary>
/// Simple test API server for testing Dev Proxy plugin.
/// </summary>
public class TestApiServer : IDisposable
{
    private readonly WebApplication _app;
    private readonly CancellationTokenSource _cts;

    public string BaseUrl { get; }

    public TestApiServer(int port = 0)
    {
        var builder = WebApplication.CreateBuilder();
        
        // Configure to listen on a random port if 0
        builder.WebHost.UseUrls(port == 0 ? "http://127.0.0.1:0" : $"http://127.0.0.1:{port}");
        
        // Minimal logging for tests
        builder.Logging.ClearProviders();
        builder.Logging.SetMinimumLevel(LogLevel.Warning);

        _app = builder.Build();

        // Simple API endpoints
        _app.MapGet("/api/test", () => Results.Ok(new { message = "Hello from test API", timestamp = DateTime.UtcNow }));
        
        _app.MapGet("/api/users/{id:int}", (int id) => Results.Ok(new { id, name = $"User{id}", email = $"user{id}@example.com" }));
        
        _app.MapPost("/api/data", async (HttpRequest request) =>
        {
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            return Results.Ok(new { received = body, echo = true });
        });

        _cts = new CancellationTokenSource();
        
        // Start the server
        Task.Run(async () =>
        {
            try
            {
                await _app.RunAsync(_cts.Token);
            }
            catch (OperationCanceledException)
            {
                // Expected when stopping
            }
        });

        // Wait for server to start and get the actual URL
        var server = _app.Services.GetRequiredService<IServer>();
        var addresses = server.Features.Get<IServerAddressesFeature>();
        
        // Give it a moment to start
        SpinWait.SpinUntil(() => addresses?.Addresses.Any() == true, TimeSpan.FromSeconds(5));
        
        BaseUrl = addresses?.Addresses.FirstOrDefault() ?? $"http://127.0.0.1:{port}";
    }

    public void Dispose()
    {
        _cts.Cancel();
        _app.DisposeAsync().AsTask().Wait(TimeSpan.FromSeconds(5));
        _cts.Dispose();
    }
}
