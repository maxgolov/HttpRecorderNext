# Traffic Cop MCP - Quick Reference Card

## New MCP Tools (v0.7.6)

### 🔍 OpenTelemetry Trace Search

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

**traceparent format:** `00-{traceId}-{spanId}-{flags}`

---

### ▶️ Start Recording

```json
{
  "name": "start_capture",
  "arguments": {}
}
```

---

### ⏹️ Stop Recording

```json
{
  "name": "stop_capture",
  "arguments": {}
}
```

---

### 📊 Proxy Status

```json
{
  "name": "proxy_status",
  "arguments": {}
}
```

Returns: proxyPort (8080), apiPort (8897), recording state, etc.

---

### ⚙️ Get Configuration

```json
{
  "name": "get_config",
  "arguments": {}
}
```

Returns: anonymizeSensitiveData, mode, includeBodies, port, record

---

### 🔧 Update Configuration

```json
{
  "name": "update_config",
  "arguments": {
    "anonymizeSensitiveData": true
  }
}
```

**Toggle anonymization:** `true` = ON (default), `false` = OFF

---

## Common Workflows

### 🎬 Automated Test Recording

```json
// 1. Check if proxy is running
{ "name": "proxy_status" }

// 2. Start recording
{ "name": "start_capture" }

// ... run your tests ...

// 3. Stop recording
{ "name": "stop_capture" }

// 4. Analyze results
{ "name": "get_capture_summary", "arguments": { "filename": "latest" } }
```

---

### 🔗 Distributed Trace Analysis

```json
// 1. Find all requests in a trace
{
  "name": "search_requests",
  "arguments": {
    "filename": "latest",
    "criteria": { "traceparent": "abc123" }
  }
}

// 2. Find slow requests in trace
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

// 3. Find errors in trace
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

---

### 🔐 Security: Toggle Anonymization

```json
// Disable for debugging
{ "name": "update_config", "arguments": { "anonymizeSensitiveData": false } }

// Record with full headers
{ "name": "start_capture" }

// ... do work ...

// Re-enable for security
{ "name": "update_config", "arguments": { "anonymizeSensitiveData": true } }
```

---

## All MCP Tools (14 Total)

| Tool | Purpose |
|------|---------|
| `list_captures` | List all HAR files |
| `get_capture_summary` | Comprehensive HAR statistics |
| `get_statistics_by_status` | Group by status code |
| `get_statistics_by_size` | Group by payload size |
| `get_statistics_by_duration` | Group by response time |
| `find_authorization_failures` | Find 401/403 errors |
| `investigate_failures` | Find all 4xx/5xx errors |
| `search_requests` | Advanced search with criteria |
| `navigate_to_request` | Navigate in VS Code viewer |
| **`start_capture`** | **Start recording** ✨ |
| **`stop_capture`** | **Stop recording** ✨ |
| **`proxy_status`** | **Get proxy status** ✨ |
| **`get_config`** | **Get configuration** ✨ |
| **`update_config`** | **Update configuration** ✨ |

✨ = New in v0.7.6

---

## Default Values

- **Proxy Port:** 8080
- **API Port:** 8897
- **API Host:** 127.0.0.1
- **Anonymization:** ON (true)
- **Recording:** OFF (false)
- **Config File:** `.http-recorder/devproxyrc.json`

---

## Error Handling

All tools return consistent error structure:

```json
{
  "status": "error",
  "message": "Error details",
  "hint": "How to fix it"
}
```

**Common Issues:**
- ❌ Connection refused → Dev Proxy not running
- ⏱️ Timeout → API not responding
- 📄 File not found → devproxyrc.json missing
- 🔒 Permission denied → Cannot write config

---

## Tips & Best Practices

✅ **Check status before operations:** Use `proxy_status` first  
✅ **Handle errors gracefully:** Check response status  
✅ **Use partial TraceIds:** Search by substring for flexibility  
✅ **Combine criteria:** traceparent + status + duration for targeted search  
✅ **Toggle anonymization wisely:** OFF in dev, ON in production/CI  

---

## Documentation

📖 **Full Documentation:** `docs/MCP_NEW_FEATURES.md`  
📋 **Implementation:** `docs/IMPLEMENTATION_SUMMARY.md`  
🔧 **Base Tools:** `docs/MCP_TOOL.md`  

---

## Support

🐛 **Issues:** GitHub HttpRecorder repository  
💬 **Extension:** Traffic Cop (maxgolov.traffic-cop)  
📦 **Version:** 0.7.6
