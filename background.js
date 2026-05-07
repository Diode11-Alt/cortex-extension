// ================================================================
// CORTEX OS — Service Worker (background.js)
// Smart Tab Hibernation · Focus Blocker · Clipboard Vault
// Eye Break Reminders · Domain Time Tracking · Context Menus
// ================================================================

const INACTIVE_LIMIT_MS = 30 * 60 * 1000; // 30 min before warning
const COUNTDOWN_LIMIT_MS = 5 * 60 * 1000; // 5 min countdown to hibernate
const MIN_TABS_TO_KEEP = 5;

let tabActivity = {};
let tabCountdowns = {};
let tabImportance = {};

// ── STARTUP ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

  // Tab health check every minute
  chrome.alarms.create('tab-monitor', { periodInMinutes: 1 });

  // Smart Focus pattern check every minute
  chrome.alarms.create('smart-focus-check', { periodInMinutes: 1 });

  // Eye break reminder every 20 minutes (20-20-20 rule)
  chrome.alarms.create('eye-break', { periodInMinutes: 20 });

  // Domain time tracker every minute
  chrome.alarms.create('domain-tracker', { periodInMinutes: 1 });

  // Inject clipboard tracker into existing tabs
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        }).catch(() => {});
      }
    }
  });

  // Right-click context menu: "Save to CORTEX Notebook"
  chrome.contextMenus.create({
    id: 'cortex-save-to-notebook',
    title: 'Save to CORTEX Notebook',
    contexts: ['selection']
  });

  // Initialize default blocked sites if none exist
  chrome.storage.local.get(['cortex_blocked_sites'], (res) => {
    if (!res.cortex_blocked_sites) {
      chrome.storage.local.set({
        cortex_blocked_sites: ['youtube.com', 'facebook.com', 'twitter.com', 'instagram.com', 'reddit.com', 'tiktok.com']
      });
    }
  });
});

// ── CONTEXT MENU — Save selection to Notebook ───────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cortex-save-to-notebook' && info.selectionText) {
    const selectedText = info.selectionText.trim();
    const sourceUrl = tab.url || '';
    const sourceTitle = tab.title || '';

    chrome.storage.local.get(['cortex_notes_data'], (res) => {
      let data = res.cortex_notes_data || { notes: [], currentNoteId: null };
      const newNote = {
        id: Date.now(),
        content: `📌 Clipped from: ${sourceTitle}\n${sourceUrl}\n\n${selectedText}`,
        timestamp: Date.now()
      };
      data.notes.unshift(newNote);
      data.currentNoteId = newNote.id;
      chrome.storage.local.set({ cortex_notes_data: data });
    });
  }
});

// ── TAB TRACKING ────────────────────────────────────────────────
chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.active) tabActivity[tab.id] = Date.now();
  tabImportance[tab.id] = 1;
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;
  tabImportance[tabId] = (tabImportance[tabId] || 0) + 1;
  delete tabCountdowns[tabId];

  chrome.tabs.query({ windowId: activeInfo.windowId }, (tabs) => {
    tabs.forEach(t => {
      if (t.id !== tabId) {
        if (!tabActivity[t.id]) tabActivity[t.id] = Date.now();
      } else {
        delete tabActivity[t.id];
      }
    });
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabActivity[tabId];
  delete tabCountdowns[tabId];
  delete tabImportance[tabId];
});

// ── ALARM HANDLER ───────────────────────────────────────────────
chrome.alarms.onAlarm.addListener((alarm) => {

  // ── Tab Hibernation Monitor ──
  if (alarm.name === 'tab-monitor') {
    const now = Date.now();
    chrome.tabs.query({}, (allTabs) => {
      // Build protected list (top N most-used tabs)
      const protectedIds = allTabs
        .map(t => ({ id: t.id, score: tabImportance[t.id] || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MIN_TABS_TO_KEEP)
        .map(t => t.id);

      Object.keys(tabActivity).forEach(idStr => {
        const id = parseInt(idStr);
        if (protectedIds.includes(id)) return;

        const inactiveTime = now - tabActivity[id];

        // Show warning banner
        if (inactiveTime > INACTIVE_LIMIT_MS && !tabCountdowns[id]) {
          tabCountdowns[id] = now + COUNTDOWN_LIMIT_MS;
          chrome.scripting.executeScript({
            target: { tabId: id },
            func: () => {
              if (document.getElementById('cortex-tab-warning')) return;
              const w = document.createElement('div');
              w.id = 'cortex-tab-warning';
              w.innerHTML = `CORTEX: This tab will hibernate in 5 min to save memory. <button id="cortex-keep-open">Keep Active</button>`;
              document.body.prepend(w);
              document.getElementById('cortex-keep-open').onclick = () => {
                chrome.runtime.sendMessage({ type: 'KEEP_TAB_OPEN' });
                w.remove();
              };
            }
          }).catch(() => {});
        }

        // Hibernate (discard) after countdown
        if (tabCountdowns[id] && now > tabCountdowns[id]) {
          chrome.tabs.discard(id).catch(() => {});
          delete tabActivity[id];
          delete tabCountdowns[id];
        }
      });
    });
  }

  // ── Smart Focus (pattern-based auto-activation) ──
  if (alarm.name === 'smart-focus-check') {
    chrome.storage.local.get(['cortex_focus_active', 'cortex_smart_focus', 'cortex_blocked_sites', 'cortex_productive_streak'], (res) => {
      if (!res.cortex_smart_focus || res.cortex_focus_active) return;

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0] || !tabs[0].url) return;
        const url = tabs[0].url.toLowerCase();
        const blockedSites = res.cortex_blocked_sites || [];
        const isDistraction = blockedSites.some(s => url.includes(s.toLowerCase()));

        let streak = res.cortex_productive_streak || 0;

        if (!isDistraction && !url.includes('chrome://') && !url.includes('chrome-extension://')) {
          streak++;
        } else {
          streak = 0;
        }

        chrome.storage.local.set({ cortex_productive_streak: streak });

        // After 5 consecutive productive checks (5 minutes), auto-enable focus
        if (streak >= 5) {
          chrome.storage.local.set({ cortex_focus_active: true, cortex_productive_streak: 0 });
          chrome.notifications.create('focus-auto', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'CORTEX — Focus Mode Activated',
            message: 'You\'ve been productive for 5 minutes. Distraction sites are now blocked.'
          });
        }
      });
    });
  }

  // ── Eye Break Reminder (20-20-20 rule) ──
  if (alarm.name === 'eye-break') {
    chrome.storage.local.get(['cortex_eye_break_enabled'], (res) => {
      if (res.cortex_eye_break_enabled !== false) { // enabled by default
        chrome.notifications.create('eye-break-' + Date.now(), {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '👁️ Eye Break — 20/20/20 Rule',
          message: 'Look at something 20 feet away for 20 seconds. Your eyes need rest.'
        });
      }
    });
  }

  // ── Domain Time Tracker ──
  if (alarm.name === 'domain-tracker') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].url) return;
      try {
        const hostname = new URL(tabs[0].url).hostname;
        if (!hostname || hostname === '') return;

        const today = new Date().toISOString().split('T')[0]; // "2026-05-07"
        chrome.storage.local.get(['cortex_domain_time'], (res) => {
          let data = res.cortex_domain_time || {};
          if (!data[today]) data[today] = {};
          data[today][hostname] = (data[today][hostname] || 0) + 1; // +1 minute

          // Prune data older than 7 days
          const keys = Object.keys(data);
          if (keys.length > 7) {
            keys.sort();
            delete data[keys[0]];
          }

          chrome.storage.local.set({ cortex_domain_time: data });
        });
      } catch (e) { /* ignore invalid URLs */ }
    });
  }
});

// ── MESSAGE HANDLER ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TODAY_STATS') {
    chrome.tabs.query({}, (tabs) => {
      const closingSoon = Object.keys(tabCountdowns).length;
      sendResponse({ tabCount: tabs.length, closingSoon });
    });
    return true;
  }

  if (request.type === 'KEEP_TAB_OPEN' && sender.tab) {
    delete tabCountdowns[sender.tab.id];
    tabActivity[sender.tab.id] = Date.now();
  }

  if (request.type === 'CLIPBOARD_COPY') {
    chrome.storage.local.get(['cortex_clipboard'], (res) => {
      let history = res.cortex_clipboard || [];
      if (history.length > 0 && history[0] === request.text) return; // no dupes
      history.unshift(request.text);
      if (history.length > 50) history.pop();
      chrome.storage.local.set({ cortex_clipboard: history });
    });
  }
});

// ── FOCUS BLOCKER ───────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    chrome.storage.local.get(['cortex_focus_active', 'cortex_blocked_sites'], (res) => {
      if (!res.cortex_focus_active) return;

      const blockedSites = res.cortex_blocked_sites || [];
      const isBlocked = blockedSites.some(s => tab.url.toLowerCase().includes(s.toLowerCase()));
      if (!isBlocked) return;

      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          document.head.innerHTML = '<title>STAY FOCUSED | CORTEX</title>';
          document.body.innerHTML = `
            <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;text-align:center;">
              <div style="max-width:380px;">
                <div style="font-size:64px;margin-bottom:24px;">🛡️</div>
                <h1 style="font-size:36px;font-weight:800;margin:0 0 12px;letter-spacing:-0.5px;">Stay Focused</h1>
                <p style="font-size:15px;color:#64748b;line-height:1.7;margin:0;">CORTEX blocked this site during your deep work session. Close this tab and get back to it.</p>
                <div style="margin-top:40px;width:50px;height:3px;background:#3b82f6;border-radius:2px;display:inline-block;"></div>
              </div>
            </div>
          `;
        }
      }).catch(() => {});
    });
  }
});
