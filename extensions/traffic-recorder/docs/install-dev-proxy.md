# Installing Dev Proxy

Dev Proxy is not found in your system PATH or common installation locations. Please follow the installation instructions for your operating system below.

## Windows

### Automated Installation (Recommended)

The easiest way to install Dev Proxy on Windows is using **winget**:

**For Dev Proxy Beta (Recommended):**
```cmd
winget install Microsoft.DevProxy.Beta --silent
```

**For Dev Proxy Stable:**
```cmd
winget install Microsoft.DevProxy --silent
```

> **Important:** After installation, you **must restart your command prompt or VS Code** to refresh the PATH environment variable.

### Manual Installation

1. Download the latest release from:
   - **Beta**: https://github.com/microsoft/dev-proxy/releases (look for beta releases)
   - **Stable**: https://github.com/microsoft/dev-proxy/releases

2. Extract the files to a folder (e.g., `%USERPROFILE%\devproxy`)

3. Add to PATH:
   - Press `Win + R`, type `sysdm.cpl`, press Enter
   - Go to **Advanced** tab → **Environment Variables**
   - Under **User variables**, select **Path** → **Edit**
   - Click **New** and add: `%USERPROFILE%\devproxy`
   - Click **OK** on all dialogs

4. Restart your terminal/VS Code

### First Run (Windows)

1. Open Command Prompt or PowerShell
2. Run: `devproxy-beta` (or `devproxy` for stable)
3. **Trust Certificate**: When prompted, click **Yes** to install the "Dev Proxy CA" certificate
4. **Allow Firewall**: Click **Allow access** when Windows Firewall prompts you

---

## macOS

### Automated Installation (Recommended)

The easiest way to install Dev Proxy on macOS is using **Homebrew**:

**For Dev Proxy Beta (Recommended):**
```bash
brew tap microsoft/dev-proxy
brew install dev-proxy-beta
```

**For Dev Proxy Stable:**
```bash
brew tap microsoft/dev-proxy
brew install dev-proxy
```

### Manual Installation

1. Download the latest release:
   - **Beta**: https://github.com/microsoft/dev-proxy/releases (look for macOS beta releases)
   - **Stable**: https://github.com/microsoft/dev-proxy/releases (look for macOS releases)

2. Extract to your home directory (e.g., `~/devproxy`)

3. Add to PATH (for zsh):
   ```bash
   echo 'export PATH="$PATH:$HOME/devproxy"' >> ~/.zshrc
   source ~/.zshrc
   ```

4. For bash shell:
   ```bash
   echo 'export PATH="$PATH:$HOME/devproxy"' >> ~/.bashrc
   source ~/.bashrc
   ```

### First Run (macOS)

1. Open Terminal
2. Run: `devproxy-beta` (or `devproxy` for stable)
3. **Trust Certificate**: Press `y` when prompted to trust the "Dev Proxy CA" certificate
4. **Allow Connections**: Click **Allow** when prompted about incoming connections

---

## Linux

### Automated Installation (Recommended)

Use the installation script:

**For Dev Proxy Beta (Recommended):**
```bash
bash -c "$(curl -sL https://aka.ms/devproxy/setup-beta.sh)"
```

**For PowerShell users:**
```powershell
(Invoke-WebRequest https://aka.ms/devproxy/setup-beta.ps1).Content | Invoke-Expression
```

**For Dev Proxy Stable:**
```bash
bash -c "$(curl -sL https://aka.ms/devproxy/setup.sh)"
```

### Manual Installation

1. Download the latest release:
   - **Beta**: https://github.com/microsoft/dev-proxy/releases (look for Linux beta releases)
   - **Stable**: https://github.com/microsoft/dev-proxy/releases (look for Linux releases)

2. Extract to your home directory (e.g., `~/devproxy`)

3. Add to PATH (for bash):
   ```bash
   echo 'export PATH="$PATH:$HOME/devproxy"' >> ~/.bashrc
   source ~/.bashrc
   ```

4. For zsh shell:
   ```bash
   echo 'export PATH="$PATH:$HOME/devproxy"' >> ~/.zshrc
   source ~/.zshrc
   ```

### First Run (Linux)

1. Open Terminal
2. Run: `devproxy-beta` (or `devproxy` for stable)
3. Dev Proxy will start and configure itself

---

## Verifying Installation

After installation and restarting your terminal/VS Code, verify the installation:

```bash
# For beta
devproxy-beta --version

# For stable
devproxy --version
```

You should see version information displayed.

---

## Common Installation Locations

The extension automatically checks these locations for Dev Proxy:

### Windows
- `%LOCALAPPDATA%\Microsoft\WinGet\Packages\DevProxy.*`
- `%LOCALAPPDATA%\Microsoft\WinGet\Links`
- `%ProgramFiles%\dev-proxy`
- `C:\ProgramData\chocolatey\lib\dev-proxy\tools`
- `%USERPROFILE%\.dotnet\tools`

### macOS
- `/usr/local/bin`
- `/opt/homebrew/bin`
- `~/.dotnet/tools`
- `~/.dev-proxy`

### Linux
- `/usr/local/bin`
- `/usr/bin`
- `~/.dotnet/tools`
- `~/.local/bin`

---

## Troubleshooting

### Command Not Found After Installation

1. **Restart VS Code** - PATH changes require a reload
2. **Restart your terminal** - New PATH won't be visible in existing sessions
3. **Check PATH manually**:
   - Windows: `echo %PATH%`
   - macOS/Linux: `echo $PATH`
4. **Verify installation location** matches one of the common locations above

### Certificate Trust Issues

- **Windows**: Run as Administrator and re-run `devproxy-beta` to re-prompt for certificate
- **macOS**: Run `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.devproxy/rootCert.crt`
- **Linux**: Certificate trust varies by distribution - consult your distro's documentation

### Permission Errors

- **Windows**: Run Command Prompt or PowerShell as Administrator
- **macOS/Linux**: Some operations may require `sudo`

---

## Additional Resources

- **Official Documentation**: https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/
- **GitHub Repository**: https://github.com/microsoft/dev-proxy
- **Getting Started Guide**: https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/get-started
- **Video Tutorial**: https://www.youtube.com/watch?v=HVTJlGSxhcw

---

## Still Having Issues?

If you continue to experience problems after following these instructions:

1. Check the [Dev Proxy GitHub Issues](https://github.com/microsoft/dev-proxy/issues)
2. Review the [official documentation](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/get-started)
3. Ensure your system meets the requirements (requires .NET)

Need help? Open an issue in this extension's repository.
