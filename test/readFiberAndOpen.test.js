// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFiberAndOpen } from '../src/readFiberAndOpen.js';

const CLICK = 'data-rcts-click';
const HOVER = 'data-rcts-hover';

/**
 * Attach a div with a fake React fiber to the document body and tag it
 * with the given attribute so readFiberAndOpen can find it.
 */
function attachFiber(fiberNode, attr) {
  const el = document.createElement('div');
  el['__reactFiber$test'] = fiberNode;
  document.body.appendChild(el);
  el.setAttribute(attr, '');
  return el;
}

beforeEach(() => {
  document.body.replaceChildren();
});

// ── Element lookup ────────────────────────────────────────────────────────────

describe('element lookup', () => {
  it('returns null when no element has the attribute', () => {
    expect(readFiberAndOpen(HOVER, '')).toBeNull();
  });

  it('removes the attribute from the element after reading', () => {
    const el = attachFiber({
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 1, columnNumber: 1 },
      type: function App() {},
      return: null,
    }, HOVER);
    readFiberAndOpen(HOVER, '');
    expect(el.hasAttribute(HOVER)).toBe(false);
  });

  it('returns {error: no_fiber} when element has no React fiber key', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    el.setAttribute(HOVER, '');
    expect(readFiberAndOpen(HOVER, '')).toEqual({ error: 'no_fiber' });
  });

  it('finds fiber via __reactInternalInstance prefix too', () => {
    const el = document.createElement('div');
    el['__reactInternalInstance$test'] = {
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 1, columnNumber: 1 },
      type: function App() {},
      return: null,
    };
    document.body.appendChild(el);
    el.setAttribute(HOVER, '');
    expect(readFiberAndOpen(HOVER, '')).toMatchObject({ fileName: '/src/App.jsx' });
  });
});

// ── Strategy 1: _debugSource ──────────────────────────────────────────────────

describe('Strategy 1: _debugSource', () => {
  it('returns file info and component name', () => {
    function MyButton() {}
    attachFiber({
      _debugSource: { fileName: '/Users/adam/src/MyButton.jsx', lineNumber: 42, columnNumber: 7 },
      type: MyButton,
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '')).toEqual({
      name: 'MyButton',
      fileName: '/Users/adam/src/MyButton.jsx',
      line: 42,
      column: 7,
    });
  });

  it('defaults column to 1 when columnNumber is undefined', () => {
    attachFiber({
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 5, columnNumber: undefined },
      type: function App() {},
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '').column).toBe(1);
  });
});

// ── Strategy 2: _debugStack ───────────────────────────────────────────────────

describe('Strategy 2: _debugStack', () => {
  it('parses /@fs/ path into an absolute filesystem path', () => {
    attachFiber({
      _debugStack: 'at App (http://localhost:5173/@fs/Users/adam/Code/myapp/src/App.tsx:10:5)',
      type: function App() {},
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '')).toMatchObject({
      fileName: '/Users/adam/Code/myapp/src/App.tsx',
      line: 10,
      column: 5,
    });
  });

  it('accepts an Error object and reads its .stack property', () => {
    const err = new Error('react debug');
    err.stack = 'Error\n    at App (http://localhost:5173/@fs/Users/adam/src/App.tsx:8:3)';
    attachFiber({ _debugStack: err, type: function App() {}, return: null }, HOVER);
    expect(readFiberAndOpen(HOVER, '').fileName).toBe('/Users/adam/src/App.tsx');
  });

  it('skips node_modules and framework frames, uses first user frame', () => {
    const stack = [
      'at renderWithHooks (http://localhost:5173/node_modules/react-dom/cjs/react-dom.development.js:100:1)',
      'at processUpdateQueue (http://localhost:5173/node_modules/react-dom/cjs/react-dom.development.js:200:1)',
      'at App (http://localhost:5173/@fs/Users/adam/src/App.tsx:20:1)',
    ].join('\n');
    attachFiber({ _debugStack: stack, type: function App() {}, return: null }, HOVER);
    expect(readFiberAndOpen(HOVER, '').fileName).toBe('/Users/adam/src/App.tsx');
  });

  it('strips query params (e.g. ?t=timestamp) from the URL before parsing', () => {
    attachFiber({
      _debugStack: 'at App (http://localhost:5173/@fs/Users/adam/src/App.tsx?t=1234:10:1)',
      type: function App() {},
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '').fileName).toBe('/Users/adam/src/App.tsx');
  });

  it('resolves a URL path to an absolute path using projectRoot', () => {
    attachFiber({
      _debugStack: 'at App (http://localhost:5173/src/App.tsx:10:5)',
      type: function App() {},
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '/Users/adam/Code/myapp')).toMatchObject({
      fileName: '/Users/adam/Code/myapp/src/App.tsx',
      line: 10,
      column: 5,
    });
  });

  it('strips trailing slash from projectRoot before joining', () => {
    attachFiber({
      _debugStack: 'at App (http://localhost:5173/src/App.tsx:10:5)',
      type: function App() {},
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '/Users/adam/Code/myapp/').fileName)
      .toBe('/Users/adam/Code/myapp/src/App.tsx');
  });

  it('returns {error: no_project_root} when a URL path is found but no projectRoot is set', () => {
    attachFiber({
      _debugStack: 'at App (http://localhost:5173/src/App.tsx:10:5)',
      type: function App() {},
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '')).toEqual({
      error: 'no_project_root',
      urlPath: '/src/App.tsx',
    });
  });
});

// ── Fiber chain walking ───────────────────────────────────────────────────────

describe('fiber chain walking', () => {
  it('returns {error: no_source} when no fiber node has source info', () => {
    attachFiber({ type: function App() {}, return: null }, HOVER);
    expect(readFiberAndOpen(HOVER, '')).toEqual({ error: 'no_source' });
  });

  it('walks .return chain to find _debugSource on a parent node', () => {
    const parent = {
      _debugSource: { fileName: '/src/Parent.jsx', lineNumber: 5, columnNumber: 1 },
      type: function Parent() {},
      return: null,
    };
    attachFiber({ type: function Child() {}, return: parent }, HOVER);
    expect(readFiberAndOpen(HOVER, '')).toMatchObject({ fileName: '/src/Parent.jsx' });
  });

  it('uses the closest component name (child) with the found source (parent)', () => {
    const parent = {
      _debugSource: { fileName: '/src/Parent.jsx', lineNumber: 1, columnNumber: 1 },
      type: function Parent() {},
      return: null,
    };
    attachFiber({ type: function Child() {}, return: parent }, HOVER);
    const result = readFiberAndOpen(HOVER, '');
    expect(result.name).toBe('Child');
    expect(result.fileName).toBe('/src/Parent.jsx');
  });
});

// ── Component name resolution ─────────────────────────────────────────────────

describe('component name resolution', () => {
  it('prefers displayName over function name', () => {
    function App() {}
    App.displayName = 'ConnectedApp';
    attachFiber({
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 1, columnNumber: 1 },
      type: App,
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '').name).toBe('ConnectedApp');
  });

  it('falls back to "Component" when no fiber type is a function', () => {
    attachFiber({
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 1, columnNumber: 1 },
      type: 'div', // host element — typeof 'div' !== 'function'
      return: null,
    }, HOVER);
    expect(readFiberAndOpen(HOVER, '').name).toBe('Component');
  });
});

// ── Click mode ────────────────────────────────────────────────────────────────

describe('click mode', () => {
  it('clicks a cursor:// anchor when mode is data-rcts-click', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    attachFiber({
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 10, columnNumber: 5 },
      type: function App() {},
      return: null,
    }, CLICK);
    readFiberAndOpen(CLICK, '');
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it('forms the correct cursor:// URL', () => {
    let capturedHref;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      capturedHref = this.getAttribute('href');
    });
    attachFiber({
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 10, columnNumber: 5 },
      type: function App() {},
      return: null,
    }, CLICK);
    readFiberAndOpen(CLICK, '');
    expect(capturedHref).toBe('cursor://file/src/App.jsx:10:5');
    vi.restoreAllMocks();
  });

  it('does not click an anchor for hover mode', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    attachFiber({
      _debugSource: { fileName: '/src/App.jsx', lineNumber: 10, columnNumber: 5 },
      type: function App() {},
      return: null,
    }, HOVER);
    readFiberAndOpen(HOVER, '');
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
