async function loadStats() {
  try {
    const d = await chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' });
    document.getElementById('tabStat').textContent = d.tabCount;
    document.getElementById('closingStat').textContent = d.closingSoon;
  } catch (e) {
    console.warn('CORTEX: Could not load stats', e);
  }
}
loadStats();

const omniSearch = document.getElementById('omniSearch');
const searchResults = document.getElementById('searchResults');

omniSearch.addEventListener('input', async () => {
  const query = omniSearch.value.trim().toLowerCase();
  searchResults.innerHTML = '';
  if (!query) return;

  const tabs = await chrome.tabs.query({});
  const filtered = tabs.filter(t =>
    (t.title || '').toLowerCase().includes(query) ||
    (t.url || '').toLowerCase().includes(query)
  ).slice(0, 6);

  filtered.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'search-item';
    el.innerHTML = `
      <span class="item-title">${tab.title || 'Untitled'}</span>
      <span class="item-url">${tab.url || ''}</span>
    `;
    el.addEventListener('click', () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });
    searchResults.appendChild(el);
  });
});

document.getElementById('openNotebookBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  }
});
