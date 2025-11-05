// Copyright (c) 2025 Max Golovanov <max.golovanov+github@gmail.com>
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

namespace HttpRecorder.DevProxy;

/// <summary>
/// Configuration for the HttpRecorder Dev Proxy plugin.
/// </summary>
public class HttpRecorderPluginConfiguration
{
    /// <summary>
    /// Gets or sets the output directory for HAR files.
    /// Default is "./recordings".
    /// </summary>
    public string OutputDirectory { get; set; } = "./recordings";

    /// <summary>
    /// Gets or sets the recording mode (Record, Replay, or Auto).
    /// Default is Record.
    /// </summary>
    public string Mode { get; set; } = "Record";

    /// <summary>
    /// Gets or sets whether to include request/response bodies in recordings.
    /// Default is true.
    /// </summary>
    public bool IncludeBodies { get; set; } = true;

    /// <summary>
    /// Gets or sets whether to anonymize sensitive data in recordings.
    /// Default is true.
    /// </summary>
    public bool AnonymizeSensitiveData { get; set; } = true;

    /// <summary>
    /// Gets or sets the list of header names to anonymize.
    /// </summary>
    public string[] SensitiveHeaders { get; set; } = new[]
    {
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "X-API-Key",
        "X-Auth-Token"
    };
}
