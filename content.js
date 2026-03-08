/**
 * React Click-to-Source — Content Script (Isolated World)
 *
 * Handles the inspect-mode UI: overlay, tooltip, cursor, keyboard shortcuts.
 *
 * Fiber reading happens in the MAIN world (background.js injects a script via
 * chrome.scripting.executeScript) because Chrome's isolated-world content
 * scripts cannot enumerate DOM expando properties like __reactFiber$xxx via
 * Object.keys(). The element is tagged with a temporary data attribute so the
 * injected MAIN-world function can find it.
 */

const OVERLAY_ID = '__rcts_overlay__';
const TOOLTIP_ID = '__rcts_tooltip__';

let inspectMode = false;
let currentHoverEl = null;
let hoverTimer = null;

// ── Overlay / Tooltip ────────────────────────────────────────────────────────

function ensureElement(id, styles) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      display: 'none',
      boxSizing: 'border-box',
      ...styles,
    });
    document.documentElement.appendChild(el);
  }
  return el;
}

function showOverlay(rect) {
  const el = ensureElement(OVERLAY_ID, {
    background: 'rgba(59, 130, 246, 0.12)',
    border: '2px solid rgba(59, 130, 246, 0.85)',
    borderRadius: '3px',
  });
  Object.assign(el.style, {
    top: `${rect.top}px`, left: `${rect.left}px`,
    width: `${rect.width}px`, height: `${rect.height}px`,
    display: 'block',
  });
}

function showTooltip(info, rect) {
  const el = ensureElement(TOOLTIP_ID, {
    background: 'rgba(15, 23, 42, 0.93)',
    color: '#e2e8f0',
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    padding: '4px 10px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
    maxWidth: '90vw',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '1.5',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  });

  const rawPath = info.fileName || info.urlPath || '';
  const parts = rawPath.replace(/\\/g, '/').split('/');
  const shortPath = parts.length > 4 ? '…/' + parts.slice(-4).join('/') : rawPath;

  el.textContent = `⚛ ${info.name || 'Component'}  —  ${shortPath}:${info.line}`;

  const top = rect.top >= 30 ? rect.top - 26 : rect.bottom + 4;
  Object.assign(el.style, {
    top: `${top}px`,
    left: `${Math.min(rect.left, window.innerWidth - 10)}px`,
    display: 'block',
  });
}

function hideOverlays() {
  const o = document.getElementById(OVERLAY_ID);
  const t = document.getElementById(TOOLTIP_ID);
  if (o) o.style.display = 'none';
  if (t) t.style.display = 'none';
}

// ── Event handlers ───────────────────────────────────────────────────────────

function onMouseOver(e) {
  const target = e.target;
  if (target.id === OVERLAY_ID || target.id === TOOLTIP_ID) return;

  currentHoverEl = target;
  // Show the blue outline immediately (no fiber read needed for bounds)
  showOverlay(target.getBoundingClientRect());
  // Tooltip only appears after we have the component name (debounced async read)
  const tooltip = document.getElementById(TOOLTIP_ID);
  if (tooltip) tooltip.style.display = 'none';

  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (currentHoverEl !== target) return;
    target.setAttribute('data-rcts-hover', '');
    chrome.runtime.sendMessage({ action: 'readFiber', mode: 'hover' }, (info) => {
      target.removeAttribute('data-rcts-hover');
      if (!info || currentHoverEl !== target) return;
      showTooltip(info, target.getBoundingClientRect());
    });
  }, 80);
}

function onClick(e) {
  e.preventDefault();
  e.stopImmediatePropagation();

  setInspectMode(false, false);
  chrome.runtime.sendMessage({ action: 'inspectModeChanged', enabled: false });

  // Tag the element so the MAIN-world injected script can find it
  e.target.setAttribute('data-rcts-click', '');
  chrome.runtime.sendMessage({ action: 'readFiber', mode: 'click' }, () => {
    e.target.removeAttribute('data-rcts-click');
  });
}

function onKeyDown(e) {
  if (e.key === 'Escape' && inspectMode) {
    setInspectMode(false, false);
    chrome.runtime.sendMessage({ action: 'inspectModeChanged', enabled: false });
  }
}

// ── Inspect mode toggle ──────────────────────────────────────────────────────

function setInspectMode(enabled) {
  inspectMode = enabled;
  if (enabled) {
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.documentElement.style.cursor = 'crosshair';
  } else {
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.documentElement.style.cursor = '';
    clearTimeout(hoverTimer);
    currentHoverEl = null;
    hideOverlays();
  }
}

// ── Message listener (from popup / background) ───────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'setInspectMode') {
    setInspectMode(message.enabled);
    sendResponse({ ok: true });
  }
  if (message.action === 'getStatus') {
    sendResponse({ inspectMode });
  }
  return true;
});
