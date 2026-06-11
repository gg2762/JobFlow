// Popup: health-check the local server, then capture title+innerText+URL from active tab.

const SERVER = 'http://localhost:3737';
const CAPTURE_URL = `${SERVER}/capture`;
const HEALTH_URL  = `${SERVER}/health`;
const HEALTH_TIMEOUT_MS = 1500;

const $url = document.getElementById('url');
const $btn = document.getElementById('save');
const $status = document.getElementById('status');
const $dot = document.getElementById('dot');
const $healthLabel = document.getElementById('health-label');

function setStatus(msg, kind) { $status.textContent = msg; $status.className = 'status ' + (kind || ''); }

function setHealth(state, label) {
  $dot.className = 'dot ' + state;
  $healthLabel.textContent = label;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractFromTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title || '',
      text: (document.body && document.body.innerText) ? document.body.innerText : '',
    }),
  });
  return results[0]?.result || { title: '', text: '' };
}

// Time-limited fetch wrapper so we don't hang if the server is missing.
async function withTimeout(promiseFn, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try { return await promiseFn(controller.signal); }
  finally { clearTimeout(t); }
}

async function checkHealth() {
  try {
    const res = await withTimeout(signal => fetch(HEALTH_URL, { signal }), HEALTH_TIMEOUT_MS);
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    if (!data.ok) throw new Error('unhealthy');
    return true;
  } catch { return false; }
}

(async () => {
  try {
    const tab = await getActiveTab();
    $url.textContent = tab.url || '';

    // Health check first.
    setHealth('checking', 'checking…');
    const healthy = await checkHealth();
    if (!healthy) {
      setHealth('err', 'server down');
      setStatus('Server offline. Start it with: launchctl load ~/Library/LaunchAgents/com.jobflow.server.plist', 'err');
      $btn.disabled = true;
      return;
    }
    setHealth('ok', 'ready');

    // Bad-page guard.
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      setStatus('Cannot capture from this page.', 'err');
      $btn.disabled = true;
      return;
    }

    $btn.disabled = false;
    $btn.addEventListener('click', async () => {
      $btn.disabled = true;
      setStatus('Capturing…');
      try {
        const { title, text } = await extractFromTab(tab.id);
        if (!text || text.length < 50) throw new Error('No JD text found on page.');
        const res = await fetch(CAPTURE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: tab.url, title, text }),
        });
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const data = await res.json();
        setStatus('Saved (' + data.id + ').', 'ok');
        setTimeout(() => window.close(), 1200);
      } catch (e) {
        setStatus(e.message || 'Capture failed.', 'err');
        $btn.disabled = false;
      }
    });
  } catch (e) {
    setHealth('err', 'error');
    setStatus('Error: ' + (e.message || e), 'err');
    $btn.disabled = true;
  }
})();
