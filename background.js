/**
 * React Click-to-Source — Background Service Worker
 *
 * Injects a self-contained function into the page's MAIN world to:
 *   1. Read the React fiber from a tagged DOM element
 *   2. For click mode: open the file in Cursor by clicking a hidden
 *      cursor:// anchor — exactly how mailto: links work on web pages.
 *      Chrome passes the custom scheme to the OS, which opens Cursor.
 */

// ── MAIN-world injection ──────────────────────────────────────────────────────
// Must be entirely self-contained (no closures over extension scope).

function readFiberAndOpen(attr, projectRoot) {
  const el = document.querySelector(`[${attr}]`);
  if (!el) return null;
  el.removeAttribute(attr);

  // React attaches the fiber as __reactFiber$<randomSuffix> on DOM nodes.
  const fk = Object.keys(el).find(
    k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
  );
  if (!fk) return { error: 'no_fiber' };

  let fileInfo = null;
  let componentName = null;
  let node = el[fk];

  while (node) {
    // Strategy 1: _debugSource — absolute path (React ≤18 + Babel source plugin)
    if (!fileInfo && node._debugSource) {
      const { fileName, lineNumber, columnNumber } = node._debugSource;
      fileInfo = { fileName, line: lineNumber, column: columnNumber ?? 1 };
    }

    // Strategy 2: _debugStack — React 18.3+ / React 19 Error object.
    // First non-library stack frame = the component's source file.
    if (!fileInfo && node._debugStack) {
      const str = (typeof node._debugStack === 'string'
        ? node._debugStack
        : node._debugStack?.stack) ?? '';
      for (const line of str.split('\n')) {
        const m = line.match(/\(?(https?:\/\/[^)]+?):(\d+):(\d+)\)?$/);
        if (!m) continue;
        let [, url, ln, col] = m;
        url = url.split('?')[0];
        if (/node_modules|react-dom|scheduler|@vite|@react-refresh|chunk-/.test(url)) continue;
        try {
          const { pathname } = new URL(url);
          fileInfo = pathname.startsWith('/@fs/')
            ? { fileName: pathname.slice(4), line: +ln, column: +col }
            : { urlPath: pathname, line: +ln, column: +col };
          break;
        } catch { continue; }
      }
    }

    if (!componentName && typeof node.type === 'function') {
      componentName = node.type.displayName || node.type.name || null;
    }

    if (fileInfo && componentName) break;
    node = node.return;
  }

  if (!fileInfo) return { error: 'no_source' };

  // Resolve absolute filesystem path
  let absPath = fileInfo.fileName;
  if (!absPath && fileInfo.urlPath) {
    if (!projectRoot) return { error: 'no_project_root', urlPath: fileInfo.urlPath };
    absPath = projectRoot.replace(/\/$/, '') + fileInfo.urlPath;
  }

  const result = {
    name: componentName || 'Component',
    fileName: absPath,
    line: fileInfo.line,
    column: fileInfo.column,
  };

  // For click: open in Cursor by clicking a hidden cursor:// anchor.
  // This runs in the MAIN world, so Chrome treats it like a user clicking
  // a custom-protocol link on the page → OS opens Cursor, page stays put.
  if (attr === 'data-rcts-click' && absPath) {
    const url = `cursor://file${absPath}:${fileInfo.line}:${fileInfo.column}`;
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.documentElement.appendChild(a);
    a.click();
    document.documentElement.removeChild(a);
  }

  return result;
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (message.action === 'readFiber') {
    if (tabId == null) { sendResponse(null); return; }

    const attr = message.mode === 'hover' ? 'data-rcts-hover' : 'data-rcts-click';

    (async () => {
      const { projectRoot = '' } = await chrome.storage.local.get('projectRoot');

      let results;
      try {
        results = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: readFiberAndOpen,
          args: [attr, projectRoot],
        });
      } catch (err) {
        console.error('[React Click-to-Source] executeScript failed:', err);
        sendResponse(null);
        return;
      }

      const info = results?.[0]?.result;

      if (info?.error) {
        console.warn('[React Click-to-Source]', info.error, info);
        if (info.error === 'no_project_root') {
          console.warn('→ Open the extension popup and set your project root (e.g. /Users/you/Code/myapp).');
        }
      } else if (info) {
        console.log(`[React Click-to-Source] ${message.mode === 'click' ? 'Opening' : 'Hovering'}: ${info.fileName}:${info.line}:${info.column}`);
      }

      sendResponse(info?.error ? null : (info ?? null));
    })();

    return true; // async sendResponse
  }

  if (message.action === 'inspectModeChanged' && tabId != null) {
    if (message.enabled) {
      chrome.action.setBadgeText({ text: 'ON', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});
