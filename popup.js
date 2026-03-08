const toggleBtn = document.getElementById('toggleBtn');
const btnIcon = document.getElementById('btnIcon');
const btnLabel = document.getElementById('btnLabel');
const hint = document.getElementById('hint');
const projectRootInput = document.getElementById('projectRoot');
const saveRootBtn = document.getElementById('saveRoot');
const rootHint = document.getElementById('rootHint');

let isInspecting = false;

function updateUI(active) {
  isInspecting = active;
  if (active) {
    toggleBtn.className = 'on';
    btnIcon.textContent = '⊗';
    btnLabel.textContent = 'Stop Inspecting';
    hint.textContent = 'Click any element on the page. Press Escape to cancel.';
  } else {
    toggleBtn.className = 'off';
    btnIcon.textContent = '⊙';
    btnLabel.textContent = 'Start Inspecting';
    hint.textContent = 'Click to activate, then click any component on the page.';
  }
}

toggleBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const next = !isInspecting;
  updateUI(next);

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'setInspectMode', enabled: next });
  } catch {
    // Content script not yet injected on this tab — inject it then retry
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { action: 'setInspectMode', enabled: next });
  }

  if (next) {
    chrome.action.setBadgeText({ text: 'ON', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId: tab.id });
    window.close(); // Close popup so the user can click on the page
  } else {
    chrome.action.setBadgeText({ text: '', tabId: tab.id });
  }
});

// ── Project root ─────────────────────────────────────────────────────────────

saveRootBtn.addEventListener('click', () => {
  const root = projectRootInput.value.trim().replace(/\/$/, '');
  chrome.storage.local.set({ projectRoot: root }, () => {
    rootHint.textContent = root ? `Saved: ${root}` : 'Cleared.';
    rootHint.style.color = '#22c55e';
    setTimeout(() => {
      rootHint.textContent = 'Required for React 19. Absolute path to your project folder.';
      rootHint.style.color = '';
    }, 2000);
  });
});

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { projectRoot = '' } = await chrome.storage.local.get('projectRoot');
  projectRootInput.value = projectRoot;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      if (response) updateUI(response.inspectMode);
    } catch {
      // Content script not injected yet — defaults to off
    }
  }
}

init();
