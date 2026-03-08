/**
 * React Click-to-Source — Fiber Reader
 *
 * This is the function injected into the page's MAIN world by background.js via
 * chrome.scripting.executeScript. Because injected functions must be entirely
 * self-contained (no closures over extension scope), background.js keeps its
 * own inline copy of this function.
 *
 * This module exports the same function so it can be unit-tested independently.
 * If you change the logic here, mirror the change in background.js (and vice versa).
 */

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

module.exports = { readFiberAndOpen };
