# React Click-to-Source

## Purpose
A Chrome Extension (Manifest V3) that lets developers click on React components in any webpage to jump directly to their source file in Cursor IDE. Also includes a tiny local Node.js HTTP server as an alternative open mechanism.

## Architecture
- **content.js** — Content script (isolated world): manages inspect-mode UI (overlay, tooltip, cursor, keyboard shortcuts). Listens for mouse/click/keydown events when active.
- **background.js** — Service worker: injects `readFiberAndOpen()` into the page's MAIN world via `chrome.scripting.executeScript`. Reads React fiber (`__reactFiber$*`) to get component name + source location. For click: opens file via `cursor://file...` custom URI scheme.
- **popup.html / popup.js** — Extension popup: toggle inspect mode, set project root path (needed for React 19 URL-based paths).
- **server.js** — Optional local HTTP server on port 3333. Receives `POST /open` with `{file, line, column}` and runs `cursor --goto file:line:col`. Health check at `GET /ping`.
- **manifest.json** — Chrome MV3 manifest. Permissions: activeTab, scripting, storage. Host permissions: `<all_urls>`.

## Tech Stack
- Plain JavaScript (no TypeScript, no build step, no bundler)
- Chrome Extension APIs (MV3)
- Node.js (server.js only, requires Node >=16)
- `canvas` npm package (dependency for generate-icons.js)

## React Fiber Reading Strategy
1. `_debugSource` — absolute path, React ≤18 + Babel source plugin
2. `_debugStack` — React 18.3+ / React 19 Error object, parses stack frames
