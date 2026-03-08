# ⚛ React Click-to-Source

A Chrome extension that lets you click any React component on a live page and jump directly to its source file in [Cursor](https://cursor.sh) — no code changes, no build plugins required.

![demo](https://github.com/user-attachments/assets/a749485a-8460-43fc-bd5f-1cec136eb7bd)

---

## Features

- **Click to open** — inspect any element, click it, Cursor opens at the exact line
- **Hover tooltip** — see the component name and file path before you click
- **Zero setup** — works with any React app in development mode, nothing to install in the target project
- **React 18 & 19** — handles both `_debugSource` (Babel source maps) and `_debugStack` (React 19 Error-based stacks)
- **No local server** — opens files via the `cursor://` URI scheme, the same way `mailto:` links open your email client

---

## How it works

```
User clicks element
       │
       ▼
content.js (isolated world)
  Tags the DOM element with data-rcts-click
  Sends message to background service worker
       │
       ▼
background.js (service worker)
  Injects readFiberAndOpen() into the page's MAIN world
       │
       ▼
readFiberAndOpen() (MAIN world — can read React internals)
  Finds __reactFiber$* on the DOM node
  Walks the fiber tree to find source info:
    • _debugSource → absolute path  (React ≤18 + Babel)
    • _debugStack  → stack trace URL (React 18.3+ / 19)
  Clicks a hidden <a href="cursor://file/path:line:col">
       │
       ▼
OS opens Cursor at the right file and line
```

Chrome's isolated-world content scripts cannot read React's fiber expando properties (`__reactFiber$...`) via `Object.keys()`. The extension works around this by injecting a self-contained function into the page's **MAIN world** using `chrome.scripting.executeScript`, which has full access to the page's JavaScript environment.

---

## Requirements

- **Chrome 116+** (Manifest V3, `chrome.scripting` API)
- **[Cursor](https://cursor.sh)** IDE installed
- A React app running in **development mode** (production builds strip fiber debug info)

---

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/adapass182/react-click-to-source.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the cloned folder

The ⚛ icon will appear in your toolbar.

---

## Usage

1. Navigate to a React app running in development mode
2. Click the **⚛ React Click-to-Source** toolbar icon
3. Click **Start Inspecting** — the cursor changes to a crosshair and the toolbar badge shows **ON**
4. Hover over any element to see a tooltip with the component name and file path
5. **Click** the element — the popup closes and Cursor opens at the exact line
6. Press **Escape** at any time to cancel inspect mode

---

## Configuration

### Project Root (React 19 only)

React 19 encodes source locations as development server URLs (e.g. `http://localhost:5173/src/App.tsx`) rather than absolute file paths. To resolve these to your filesystem, open the extension popup and set your **Project Root**:

```
/Users/you/Code/my-app
```

This is not needed for React ≤18 projects using the Babel source plugin, which provide absolute paths directly.

---

## React version compatibility

| React version | Source strategy | Project Root needed? |
|---|---|---|
| ≤18 + `@babel/plugin-transform-react-jsx-source` | `_debugSource` — absolute path | No |
| 18.3+ / 19 (Vite / dev server) | `_debugStack` — parses dev server URL | Yes (unless `/@fs/` path) |
| 18.3+ / 19 (Vite with `/@fs/` absolute paths) | `_debugStack` — strips `/@fs` prefix | No |

> **Tip:** Vite serves files under `/@fs/` when they live outside the project root. In that case the extension can resolve the absolute path without any configuration.

---

## Troubleshooting

**Tooltip appears but Cursor doesn't open**
The `cursor://` URI scheme is registered by Cursor on installation. If it isn't working, try opening `cursor://file/tmp/test:1:1` directly in Chrome's address bar to confirm the scheme is registered.

**`no_project_root` warning in the console**
Your app is using React 19 and serving files at a relative URL path. Open the extension popup and set the Project Root to your project's absolute directory path.

**Tooltip shows "Component" instead of a name**
The hovered element is a host element (e.g. `<div>`) with no named React component ancestor in the fiber tree. Try hovering a parent element.

**No tooltip at all**
The page is either not a React app, or it's running in production mode (fiber debug info is stripped in production builds).

---

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

Tests use [Vitest](https://vitest.dev) with a jsdom environment to unit-test the core fiber-reading logic in `src/readFiberAndOpen.js`.

After making changes to the extension, go to `chrome://extensions` and click the **↻ reload** button on the extension card.

---

## License

[MIT](LICENSE)
