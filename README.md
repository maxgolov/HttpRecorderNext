# HttpRecorder Next - HTTP Traffic Recording for Testing & Debugging

> **Record, replay, and analyze HTTP traffic across .NET, Dev Proxy, and 20+ test frameworks**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-8.0%20%7C%209.0-blue.svg)](https://dotnet.microsoft.com)
[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Traffic%20Cop-blue.svg)](extensions/traffic-recorder)

---

## 🎯 What is HttpRecorder Next?

A comprehensive HTTP traffic recording ecosystem that captures complete request/response flows in standard HAR format. Record browser traffic, backend API calls, and microservice interactions—then replay them for deterministic tests.

### Three Recording Approaches

| Approach | Best For | Get Started |
|----------|----------|-------------|
| **🎭 VS Code Extension** | E2E tests with Playwright, Jest, pytest, JUnit, etc. | [Extension Docs](extensions/traffic-recorder/README.md) |
| **📦 .NET Library** | .NET HttpClient instrumentation | [.NET Examples](#net-library-quick-start) |
| **🔌 Dev Proxy Plugin** | Any language via system proxy | [Plugin Guide](DevProxyExtension/README.md) |

**All three share the same HAR format** - record with one, replay with another.

---

## 🚀 Key Features

- ✅ **Full-Stack Capture** - Browser → Frontend → Backend → External APIs
- ✅ **20+ Test Frameworks** - Auto-detection for Playwright, pytest, JUnit, Jest, and more
- ✅ **Privacy-First** - Automatic anonymization of auth tokens and sensitive headers  
- ✅ **Standard HAR Format** - Compatible with Chrome DevTools, Fiddler, and all HAR viewers
- ✅ **Record & Replay Modes** - Deterministic tests without live network calls

---

## 📦 Quick Start

### VS Code Extension (Traffic Cop)

**Install:**
```bash
code --install-extension traffic-cop-0.7.0.vsix
```

**Use:**
1. Open workspace with tests (e.g., `playwright.config.ts`)
2. Click "Record Tests" in status bar
3. Run tests - traffic saved to `.http-recorder/*.har`

👉 **[Full Extension Documentation](extensions/traffic-recorder/README.md)**

---

### .NET Library Quick Start

**Install:**
```bash
dotnet add package HttpRecorder.Next
```

**Basic Usage:**
```csharp
using HttpRecorder;

// Record HTTP traffic
var handler = new HttpRecorderDelegatingHandler("recordings/api.har");
var client = new HttpClient(handler) { 
    InnerHandler = new HttpClientHandler() 
};

await client.GetAsync("https://api.example.com/users");
// Saved to recordings/api.har
```

**Recording Modes:**
- `Auto` (default) - Replay if HAR exists, otherwise record
- `Record` - Always record (overwrite)
- `Replay` - Always replay (fail if missing)
- `Passthrough` - No record/replay

**HttpClientFactory Integration:**
```csharp
services
    .AddHttpClient("github")
    .AddHttpRecorder("recordings/github.har");
```

**Advanced Features:**
- Custom matchers (URI, headers, method)
- Data anonymization (tokens, cookies, PII)
- ASP.NET Core integration tests with `HttpRecorderContext`

---

### Dev Proxy Plugin

**Install:**
```bash
dotnet add package HttpRecorder.DevProxy
```

**Configure** (`devproxyrc.json`):
```json
{
  "plugins": [{
    "name": "HttpRecorderPlugin",
    "pluginPath": "./plugins/HttpRecorder.DevProxy.dll",
    "configSection": "httpRecorder"
  }],
  "httpRecorder": {
    "outputDirectory": "./recordings",
    "mode": "Record",
    "anonymizeSensitiveData": true
  }
}
```

**Run:**
```bash
devproxy-beta --config-file devproxyrc.json
```

👉 **[Plugin Development Guide](DevProxyExtension/README.md)**

---

## 🎭 Supported Test Frameworks

Traffic Cop auto-detects 20+ frameworks:

**JavaScript/TypeScript:** Playwright, Jest, Vitest, Cypress, Mocha, Jasmine, TestCafe  
**Python:** pytest, unittest, Robot Framework  
**Java:** JUnit, TestNG, Kotest  
**C#/.NET:** NUnit, xUnit  
**Other:** Go test, RSpec (Ruby), PHPUnit, XCTest (Swift)

[View full framework compatibility table →](extensions/traffic-recorder/README.md#supported-frameworks)

---

## 📊 Real-World Use Cases

- **E2E Debugging** - See complete request chains from UI to database
- **API Cost Tracking** - Monitor OpenAI/Azure/AWS usage during tests
- **Performance Analysis** - Identify slow calls, retries, N+1 queries
- **Smart Mocking** - Create realistic fixtures from production-like tests
- **Regression Testing** - Replay recorded interactions for deterministic tests

---

## 📚 Documentation

- **[Traffic Cop Extension](extensions/traffic-recorder/README.md)** - Complete VS Code guide
- **[Dev Proxy Plugin](DevProxyExtension/README.md)** - Plugin configuration
- **[AI Agent Guide](extensions/traffic-recorder/AI-GUIDE.md)** - For AI assistants
- **[Contributing](CONTRIBUTING.md)** - Contribution guidelines
- **[Code of Conduct](CODE_OF_CONDUCT.md)** - Community guidelines

---

## 🔧 Requirements

- **.NET SDK:** 8.0 or 9.0  
- **VS Code:** 1.105.0+ (for extension)
- **Node.js:** 20.0.0+ (for extension development)
- **Dev Proxy:** v1.3.0-beta.2+ (auto-installed by extension)

---

## 📦 Package Sizes

| Package | Size | What's Included |
|---------|------|-----------------|
| Traffic Cop Extension | 290 KB | Extension + plugin DLLs |
| HttpRecorder.Next | ~40 KB | Core .NET library |
| HttpRecorder.DevProxy | ~25 KB | Dev Proxy plugin |

---

## 📈 What's New in v0.7.0

- 🎭 Renamed to "Traffic Cop" with professional branding
- 🔍 Auto-detection for 20+ test frameworks (up from 15)
- 🧪 102 tests passing (74 .NET + 28 TypeScript)
- 🏗️ Refactored architecture with template method pattern
- 📚 Enhanced documentation and roadmap

---

## 🤝 Contributing

We welcome contributions! Add new framework detectors, improve documentation, or suggest features.

**Adding a framework detector:**
1. Extend base class (`JavaScriptFrameworkDetector`, etc.)
2. Implement detection logic
3. Add tests
4. Update docs

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines.

---

## 📜 License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

Original [HttpRecorder by nventive](https://github.com/nventive/HttpRecorder) - Foundation for .NET library

---

## 📞 Maintainer

**Max Golovanov**  
📧 max.golovanov+github@gmail.com  
🐙 [github.com/maxgolov](https://github.com/maxgolov)

---

<div align="center">

**Made with ❤️ for developers who need complete HTTP traffic visibility**

[⬆ Back to Top](#httprerecorder-next---http-traffic-recording-for-testing--debugging)

</div>
