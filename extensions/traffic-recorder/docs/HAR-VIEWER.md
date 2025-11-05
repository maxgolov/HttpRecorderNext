# HAR Viewer Guide

## Overview

The Traffic Recorder extension includes a modern, interactive HAR (HTTP Archive) file viewer built with **Vite**, **TypeScript 5.6**, and **Fluent UI v9**. This viewer provides a user-friendly interface to analyze HTTP traffic recordings.

## Features

### 🎨 Modern UI
- **Fluent UI v9** components for a native VS Code look and feel
- **Automatic theme detection** - follows your VS Code theme (light/dark/high contrast)
- **Responsive design** - split-panel layout with resizable sections
- **VS Code color token integration** - perfectly matches your editor theme

### 📊 Sortable Table
- **Click column headers** to sort by:
  - Method (GET, POST, PUT, DELETE, etc.)
  - Path
  - Status code
  - Content type
  - Size
  - Time
- **Color-coded HTTP methods**:
  - 🟢 GET (green)
  - 🔵 POST (blue)
  - 🟠 PUT (orange)
  - 🔴 DELETE (red)
- **Status code indicators**:
  - ✅ 2xx Success (green)
  - ↗️ 3xx Redirect (blue)
  - ❌ 4xx/5xx Error (red)

### 🔍 Search & Filter
- **Real-time search** across all request data
- Filter by:
  - URL/path
  - HTTP method
  - Status code
  - Content type

### 📝 Detailed Request/Response Inspector
Split panel with tabbed interface:

#### Headers Tab
- **Request headers** - view all outgoing headers
- **Response headers** - view all incoming headers
- Easy-to-read table format with name-value pairs

#### Request Tab
- **General info**: URL, method, HTTP version
- **Query parameters** - parsed and displayed as table
- **Request body** - formatted display of POST/PUT data

#### Response Tab
- **Response details**: status, content-type, size
- **Response body** - with JSON pretty-printing
- Syntax highlighting for common content types

#### Timings Tab
- **Timing breakdown**:
  - Blocked time
  - DNS lookup
  - Connection time
  - Send time
  - Wait time (TTFB)
  - Receive time
- **Visual timeline bar** - proportional segments showing each phase
- **Total request time** calculation

## Usage

### Opening HAR Files

There are three ways to open HAR files in the viewer:

#### 1. Explorer Context Menu
1. Right-click any `.har` file in the Explorer
2. Select **"Traffic Recorder: Preview HAR File"**

#### 2. Editor Title Bar
1. Open a `.har` file in the editor
2. Click the **Preview** icon (👁️) in the editor title bar

#### 3. Command Palette
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "Traffic Recorder: Preview HAR File"
3. Select the command

### Viewing Request Details

1. Click any row in the requests table
2. The details panel opens on the right side
3. Switch between tabs to view:
   - **Headers**: Request and response headers
   - **Request**: Request details and body
   - **Response**: Response details and body
   - **Timings**: Performance breakdown

### Searching Requests

1. Use the search box at the top of the requests table
2. Type any part of:
   - URL/path
   - HTTP method
   - Status code
   - Content type
3. Results filter in real-time

### Sorting Requests

1. Click any column header to sort:
   - First click: ascending order
   - Second click: descending order
   - Visual indicator (▲/▼) shows current sort

## Working with Dev Proxy

The HAR viewer integrates seamlessly with Dev Proxy recordings:

### Automatic Location
- Dev Proxy saves HAR files to `.http-recorder/` by default
- Files are named with timestamps: `recording_2024-11-04_15-30-45.har`

### Live Updates
- When a HAR file is updated, the viewer automatically refreshes
- Great for monitoring ongoing recordings

### Workflow
1. **Start Dev Proxy** from the Tree View or Command Palette
2. **Run your tests** or browse with proxy
3. **Find HAR files** in `.http-recorder/` directory
4. **Right-click and Preview** to analyze traffic

## Architecture

### Technology Stack
- **Vite 5.4** - Fast build tool and dev server
- **TypeScript 5.6** - Type-safe development
- **React 18.3** - UI framework
- **Fluent UI v9** - Microsoft's design system
- **VS Code WebView API** - Embedded browser context

### File Structure
```
har-viewer/
├── src/
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # Main app component
│   ├── types.ts           # HAR format TypeScript types
│   ├── index.css          # VS Code theme CSS variables
│   └── components/
│       ├── HARTable.tsx   # Sortable request table
│       └── HARDetails.tsx # Request/response details panel
├── dist/                  # Build output (in extension)
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── vite.config.ts         # Vite build config
