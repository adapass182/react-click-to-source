# Code Style & Conventions

- Plain JavaScript (ES2020+), no TypeScript
- No build step — files served directly to Chrome
- JSDoc comments at top of each file explaining its purpose
- Section separators: `// ── Section Name ───...` (em-dash style)
- `const` preferred, `let` for mutable state
- Arrow functions for callbacks, regular functions for named top-level functions
- No semicolons omitted (semicolons used)
- Template literals for string interpolation
- Chrome Extension message passing: `chrome.runtime.sendMessage` / `onMessage.addListener`
- Async/await used in popup.js and background.js
- Error handling: try/catch with `console.error`/`console.warn`
