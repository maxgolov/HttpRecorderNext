# Traffic Cop MCP Server - New Features (v0.7.6)

This document describes the new features added to the Traffic Cop MCP server for enhanced OpenTelemetry integration and programmatic proxy control.

## Overview

The Traffic Cop MCP server now supports:

1. **OpenTelemetry Trace Correlation** - Search for requests by traceparent header TraceId
2. **Programmatic Proxy Control** - Start/stop Dev Proxy recording via REST API
3. **Proxy Status Queries** - Get current proxy port, API port, and state programmatically
4. **Configuration Management** - Toggle anonymizeSensitiveData and other settings

## New MCP Tools

### 1. `search_requests` - Enhanced with traceparent

**New Parameter:** `traceparent`

Search for HTTP requests by OpenTelemetry traceparent header TraceId substring.

**Format:** OpenTelemetry traceparent header format is `00-{traceId}-{spanId}-{flags}`

The tool searches for the TraceId substring in the traceparent header, enabling correlation of distributed traces across HTTP requests.

**Example:**
```json
{
  "name": "search_requests",
  "arguments": {
    "filename": "latest",
    "criteria": {
      "traceparent": "abc123"
    }
  }
}
```

This will find all requests with a traceparent header containing TraceId "abc123".

**Use Cases:**
- Correlate distributed traces across multiple HTTP requests
- Find all requests associated with a specific trace
- Debug OpenTelemetry instrumentation
- Analyze distributed transaction flows

---

### 2. `start_capture` - Start Dev Proxy Recording

Start a Dev Proxy recording session via REST API.

**Parameters:**
- `host` (optional): Dev Proxy API host (default: 127.0.0.1)
- `apiPort` (optional): Dev Proxy API port (default: 8897)

**Example:**
```json
{
  "name": "start_capture",
  "arguments": {
    "host": "127.0.0.1",
    "apiPort": 8897
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Recording started",
  "recording": true
}
```

**Use Cases:**
- Programmatically start recording before running tests
- Automate capture workflows
- Integrate with CI/CD pipelines

---

### 3. `stop_capture` - Stop Dev Proxy Recording

Stop the current Dev Proxy recording session via REST API.

**Parameters:**
- `host` (optional): Dev Proxy API host (default: 127.0.0.1)
- `apiPort` (optional): Dev Proxy API port (default: 8897)

**Example:**
```json
{
  "name": "stop_capture",
  "arguments": {
    "host": "127.0.0.1",
    "apiPort": 8897
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Recording stopped",
  "recording": false
}
```

**Use Cases:**
- Stop recording after test completion
- Control recording lifecycle programmatically
- Save recordings at specific checkpoints

---

### 4. `proxy_status` - Get Proxy Status

Get current Dev Proxy port, API port, and proxy state programmatically.

**Parameters:**
- `host` (optional): Dev Proxy API host (default: 127.0.0.1)
- `apiPort` (optional): Dev Proxy API port (default: 8897)

**Example:**
```json
{
  "name": "proxy_status",
  "arguments": {
    "host": "127.0.0.1",
    "apiPort": 8897
  }
}
```

**Response:**
```json
{
  "status": "success",
  "proxyPort": 8080,
  "apiPort": 8897,
  "recording": true,
  "asSystemProxy": false,
  "rate": null,
  "proxyInfo": {
    // Additional proxy information
  }
}
```

**Use Cases:**
- Verify proxy is running before starting tests
- Get proxy port for configuration
- Check recording state
- Monitor proxy health

---

### 5. `get_config` - Get Dev Proxy Configuration

Get current Dev Proxy configuration including anonymizeSensitiveData setting.

**Example:**
```json
{
  "name": "get_config",
  "arguments": {}
}
```

**Response:**
```json
{
  "status": "success",
  "config": {
    "anonymizeSensitiveData": true,
    "mode": "Record",
    "includeBodies": true,
    "port": 8080,
    "record": false,
    // ... full configuration
  }
}
```

**Use Cases:**
- Check current configuration settings
- Verify anonymization state
- Audit proxy configuration

---

### 6. `update_config` - Update Dev Proxy Configuration

Update Dev Proxy configuration settings (e.g., anonymizeSensitiveData).

**Parameters:**
- `anonymizeSensitiveData` (optional): Enable or disable sensitive data anonymization

**Example:**
```json
{
  "name": "update_config",
  "arguments": {
    "anonymizeSensitiveData": false
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Configuration updated successfully",
  "updated": {
    "anonymizeSensitiveData": false
  }
}
```

**Use Cases:**
- Toggle sensitive data anonymization
- Configure proxy behavior programmatically
- Adapt configuration for different environments

---

## OpenTelemetry Integration

### traceparent Header Format

The OpenTelemetry traceparent header follows the W3C Trace Context specification:

```
traceparent: 00-{traceId}-{spanId}-{flags}
```

Where:
- `00` = version
- `traceId` = 32 hex characters (128 bits)
- `spanId` = 16 hex characters (64 bits)
- `flags` = 2 hex characters (8 bits)

**Example:**
```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

### Search by TraceId

The `search_requests` tool with `traceparent` parameter searches for the TraceId substring:

```json
{
  "name": "search_requests",
  "arguments": {
    "filename": "latest",
    "criteria": {
      "traceparent": "4bf92f3577b34da6"
    }
  }
}
```

This will match the example traceparent above, enabling correlation of all requests in the same distributed trace.

### Use Cases

1. **Distributed Trace Analysis**: Find all HTTP requests involved in a distributed transaction
2. **Performance Debugging**: Correlate slow requests across services
3. **Error Investigation**: Track errors through multiple service calls
4. **Service Mesh Observability**: Analyze traffic patterns across microservices

---

## Configuration Management

### Anonymize Sensitive Data

The `anonymizeSensitiveData` setting controls whether sensitive headers (Authorization, Cookie, API keys, etc.) are anonymized in HAR recordings.

**Default:** `true` (enabled)

**Sensitive Headers Anonymized:**
- Authorization
- Cookie / Set-Cookie
- API Keys (X-API-Key, api-key, etc.)
- OAuth tokens
- CSRF tokens
- And many more...

**Enable Anonymization:**
```json
{
  "name": "update_config",
  "arguments": {
    "anonymizeSensitiveData": true
  }
}
```

**Disable Anonymization** (for trusted environments):
```json
{
  "name": "update_config",
  "arguments": {
    "anonymizeSensitiveData": false
  }
}
```

**Check Current Setting:**
```json
{
  "name": "get_config",
  "arguments": {}
}
```

---

## Workflow Examples

### Example 1: Automated Test Recording

```json
// 1. Check proxy status
{ "name": "proxy_status", "arguments": {} }

// 2. Start recording
{ "name": "start_capture", "arguments": {} }

// ... Run your tests ...

// 3. Stop recording
{ "name": "stop_capture", "arguments": {} }

// 4. Analyze captured traffic
{ "name": "get_capture_summary", "arguments": { "filename": "latest" } }
```

### Example 2: OpenTelemetry Trace Investigation

```json
// 1. Search for trace by TraceId
{
  "name": "search_requests",
  "arguments": {
    "filename": "latest",
    "criteria": {
      "traceparent": "abc123"
    }
  }
}

// 2. Analyze slow requests in the trace
{
  "name": "search_requests",
  "arguments": {
    "filename": "latest",
    "criteria": {
      "traceparent": "abc123",
      "minDuration": 1000
    }
  }
}

// 3. Find errors in the trace
{
  "name": "search_requests",
  "arguments": {
    "filename": "latest",
    "criteria": {
      "traceparent": "abc123",
      "statusRange": [400, 599]
    }
  }
}
```

### Example 3: Configuration Management

```json
// 1. Disable anonymization for debugging
{
  "name": "update_config",
  "arguments": {
    "anonymizeSensitiveData": false
  }
}

// 2. Record traffic with full headers
{ "name": "start_capture", "arguments": {} }

// ... Run tests ...

// 3. Re-enable anonymization
{
  "name": "update_config",
  "arguments": {
    "anonymizeSensitiveData": true
  }
}
```

---

## Error Handling

All tools return structured error responses when operations fail:

```json
{
  "status": "error",
  "message": "Failed to start recording: Connection refused",
  "hint": "Make sure Dev Proxy is running and accessible"
}
```

**Common Errors:**
- **Connection refused**: Dev Proxy is not running
- **Timeout**: Dev Proxy API not responding
- **File not found**: devproxyrc.json missing
- **Permission denied**: Cannot write to configuration file

---

## REST API Reference

The MCP tools use the Dev Proxy REST API internally:

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/proxy` | GET | Get proxy status |
| `/proxy/record` | POST | Start/stop recording |

### Start Recording

```http
POST http://127.0.0.1:8897/proxy/record
Content-Type: application/json

{
  "record": true
}
```

### Stop Recording

```http
POST http://127.0.0.1:8897/proxy/record
Content-Type: application/json

{
  "record": false
}
```

### Get Status

```http
GET http://127.0.0.1:8897/proxy
```

Response:
```json
{
  "proxyPort": 8080,
  "recording": true,
  "asSystemProxy": false,
  "rate": null
}
```

---

## Migration Guide

### Updating from Previous Versions

**No Breaking Changes**: All existing MCP tools remain unchanged. New tools are additive.

**New Capabilities:**
1. Add `traceparent` parameter to existing `search_requests` calls for OpenTelemetry correlation
2. Use `start_capture` / `stop_capture` for programmatic recording control
3. Use `proxy_status` to check proxy state before operations
4. Use `get_config` / `update_config` for configuration management

**Recommended Updates:**
- Add proxy status check before starting recordings
- Use traceparent search for distributed trace analysis
- Toggle anonymization based on environment (disabled in dev, enabled in CI)

---

## Best Practices

1. **Check Proxy Status First**: Always call `proxy_status` before `start_capture` to ensure Dev Proxy is running

2. **Handle Errors Gracefully**: Check response status and provide fallback behavior

3. **Anonymization Strategy**:
   - Enable in production/CI environments
   - Disable in local development for easier debugging
   - Document configuration decisions

4. **OpenTelemetry Correlation**:
   - Use full or partial TraceId for searches
   - Combine with status/duration filters for targeted analysis
   - Consider caching TraceIds for multi-query workflows

5. **Configuration Management**:
   - Read config before modifying
   - Backup devproxyrc.json before updates
   - Validate configuration after changes

---

## Support

For issues or questions:
- GitHub: [HttpRecorder Repository](https://github.com/maxgolov/HttpRecorder)
- Documentation: See `docs/MCP_TOOL.md` for base functionality
- Extension: Traffic Cop (maxgolov.traffic-cop)

---

## Version History

### v0.7.6 (Current)
- Added `traceparent` parameter to `search_requests` for OpenTelemetry integration
- Added `start_capture` tool for programmatic recording control
- Added `stop_capture` tool for programmatic recording control
- Added `proxy_status` tool for status queries
- Added `get_config` tool for configuration retrieval
- Added `update_config` tool for configuration management
- Enhanced error handling and documentation

### v0.7.0
- Initial MCP server release with 9 base tools
