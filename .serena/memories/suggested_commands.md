# Suggested Commands

## Running
```bash
# Start the local file-open server (optional, port 3333 by default)
node server.js

# Custom port
node server.js --port 3334
```

## Installing the Chrome Extension
1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked" → select project root `/Users/adam/Code/react-click-to-source`

## No Build Step
This project has no build/bundle step. Files are loaded directly by Chrome.

## npm
```bash
npm install   # installs canvas (used by generate-icons.js)
node generate-icons.js  # regenerate icons in icons/
```

## No linting/formatting/testing configured
No ESLint, Prettier, or test framework is set up.
