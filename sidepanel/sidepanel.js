// ================================================================
// CORTEX OS — Side Panel Logic
// Notebook · Vault · Focus · Stats
// ================================================================

// ── Tab Switching ───────────────────────────────────────────────
const tabBtns = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    views.forEach(v => {
      v.classList.remove('active-view');
      v.classList.add('hidden-view');
    });
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.target);
    target.classList.remove('hidden-view');
    target.classList.add('active-view');

    // Refresh data when switching to specific tabs
    if (btn.dataset.target === 'clipboard-view') renderClipboard();
    if (btn.dataset.target === 'stats-view') renderDomainStats();
  });
});

// ══════════════════════════════════════════════════════════════════
// NOTEBOOK — Multi-Note with Topics, Line Numbers & Sidebar Toggle
// ══════════════════════════════════════════════════════════════════
const scratchpad = document.getElementById('scratchpadInput');
const lineNumbers = document.getElementById('lineNumbers');
const noteSearch = document.getElementById('noteSearch');
const noteTopic = document.getElementById('noteTopic');
const notesList = document.getElementById('notesList');
const newNoteBtn = document.getElementById('newNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const copyNoteBtn = document.getElementById('copyNoteBtn');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const notesSidebar = document.getElementById('notesSidebar');

// ... later in the file ...

// ── Copy note ──
copyNoteBtn.addEventListener('click', async () => {
  const content = scratchpad.innerText;
  if (!content) return;
  try {
    await navigator.clipboard.writeText(content);
    const orig = copyNoteBtn.textContent;
    copyNoteBtn.textContent = '✓';
    setTimeout(() => { copyNoteBtn.textContent = orig; }, 1000);
  } catch (e) {}
});

let notes = [];
let currentNoteId = null;

// ── Sidebar toggle ──
toggleSidebarBtn.addEventListener('click', () => {
  notesSidebar.classList.toggle('collapsed');
});

// ── Line numbers & Stats ──
function updateLineNumbers() {
  const text = scratchpad.innerText || '';
  const count = text.split('\n').length || 1;
  let html = '';
  for (let i = 1; i <= count; i++) html += i + '<br>';
  lineNumbers.innerHTML = html;
  updateStats(text);
}

function updateStats(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  document.getElementById('wordCount').textContent = `${words} words`;
  document.getElementById('charCount').textContent = `${chars} chars`;
}

// ── Sync scroll between line numbers and editor ──
const editorWrapper = document.querySelector('.editor-wrapper');
if (editorWrapper) {
  editorWrapper.addEventListener('scroll', () => {
    lineNumbers.style.transform = `translateY(-${editorWrapper.scrollTop}px)`;
  });
}

// ── Note persistence ──
let isSaving = false;
function saveNotes() {
  isSaving = true;
  chrome.storage.local.set({ cortex_notes_data: { notes, currentNoteId } }, () => {
    // Reset flag after a short delay to ensure onChanged event is processed
    setTimeout(() => { isSaving = false; }, 100);
  });
}

function getNoteDisplayTitle(note) {
  if (note.topic && note.topic.trim()) return note.topic.trim();
  const text = (note.content || '').trim();
  const firstLine = text.split('\n')[0] || '';
  if (firstLine.length > 28) return firstLine.substring(0, 28) + '…';
  return firstLine || 'Untitled';
}

function renderNotesList(filterQuery) {
  notesList.innerHTML = '';
  let sorted = [...notes].sort((a, b) => b.timestamp - a.timestamp);

  // If there's a filter query, filter by topic match
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    sorted = sorted.filter(n => {
      const topic = (n.topic || '').toLowerCase();
      const content = (n.content || '').toLowerCase();
      return topic.includes(q) || content.includes(q);
    });
  }

  sorted.forEach(note => {
    const el = document.createElement('div');
    el.className = 'note-thumb' + (note.id === currentNoteId ? ' active' : '');

    const title = getNoteDisplayTitle(note);
    const topic = note.topic && note.topic.trim() ? note.topic.trim() : null;

    if (topic) {
      el.innerHTML = `<span class="thumb-topic">${topic}</span>`;
    } else {
      el.textContent = title;
    }

    el.addEventListener('click', () => {
      saveCurrentNoteContent();
      currentNoteId = note.id;
      loadCurrentNote();
      renderNotesList(noteSearch.value.trim());
      saveNotes();
    });
    notesList.appendChild(el);
  });

  // Show "no results" state
  if (sorted.length === 0 && filterQuery) {
    notesList.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:20px;font-size:11px;">No notes match<br>"' + filterQuery + '"</div>';
  }
}

function saveCurrentNoteContent() {
  const note = notes.find(n => n.id === currentNoteId);
  if (note) {
    note.content = scratchpad.innerText;
    note.topic = noteTopic.value.trim();
    note.timestamp = Date.now();
  }
}

function loadCurrentNote() {
  const note = notes.find(n => n.id === currentNoteId);
  if (note) {
    scratchpad.innerText = note.content || '';
    noteTopic.value = note.topic || '';
  } else {
    scratchpad.innerText = '';
    noteTopic.value = '';
  }
  updateLineNumbers();
}

// ── Initialize notes from storage ──
chrome.storage.local.get(['cortex_notes_data'], (res) => {
  if (res.cortex_notes_data) {
    notes = res.cortex_notes_data.notes || [];
    currentNoteId = res.cortex_notes_data.currentNoteId;
  }
  if (notes.length === 0) {
    const first = { id: Date.now(), topic: 'Welcome', content: 'Welcome to CORTEX Notebook.\nStart typing here...', timestamp: Date.now() };
    notes.push(first);
    currentNoteId = first.id;
  }
  if (!notes.find(n => n.id === currentNoteId)) {
    currentNoteId = notes[0].id;
  }
  renderNotesList();
  loadCurrentNote();
});

// Listen for external note additions (e.g. from context menu)
chrome.storage.onChanged.addListener((changes) => {
  if (isSaving) return; // Don't reload if we are the one saving

  if (changes.cortex_notes_data) {
    const newData = changes.cortex_notes_data.newValue;
    if (newData && newData.notes) {
      notes = newData.notes;
      currentNoteId = newData.currentNoteId;
      renderNotesList(noteSearch.value.trim());
      // Only reload current note if user is NOT currently typing
      if (document.activeElement !== scratchpad) {
        loadCurrentNote();
      }
    }
  }
});

// ── New note ──
newNoteBtn.addEventListener('click', () => {
  saveCurrentNoteContent();
  const newNote = { id: Date.now(), topic: '', content: '', timestamp: Date.now() };
  notes.unshift(newNote);
  currentNoteId = newNote.id;
  renderNotesList();
  loadCurrentNote();
  saveNotes();
  noteTopic.focus(); // focus on topic field first
});

// ── Delete note ──
deleteNoteBtn.addEventListener('click', () => {
  if (notes.length <= 1) return;
  notes = notes.filter(n => n.id !== currentNoteId);
  currentNoteId = notes[0].id;
  renderNotesList();
  loadCurrentNote();
  saveNotes();
});

// ── Topic input ──
noteTopic.addEventListener('input', () => {
  const note = notes.find(n => n.id === currentNoteId);
  if (note) {
    note.topic = noteTopic.value.trim();
    note.timestamp = Date.now();
    saveNotes();
    renderNotesList(noteSearch.value.trim());
  }
});

// ── Paste handler (force plain text) ──
scratchpad.addEventListener('paste', (e) => {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});

// ── Input handler (debounced save) ──
let saveDebounce = null;
scratchpad.addEventListener('input', () => {
  updateLineNumbers();
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    saveCurrentNoteContent();
    saveNotes();
    renderNotesList(noteSearch.value.trim());
  }, 400);
});

// ── Search across all notes by topic or content ──
noteSearch.addEventListener('input', () => {
  const query = noteSearch.value.trim();
  renderNotesList(query);
});

// ══════════════════════════════════════════════════════════════════
// CLIPBOARD VAULT
// ══════════════════════════════════════════════════════════════════
const clipboardList = document.getElementById('clipboardList');

function renderClipboard() {
  chrome.storage.local.get(['cortex_clipboard'], (res) => {
    const history = res.cortex_clipboard || [];
    clipboardList.innerHTML = '';

    if (history.length === 0) {
      clipboardList.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:40px 20px;font-size:13px;">Vault is empty.<br>Copy some text on any page!</div>';
      return;
    }

    history.forEach((text) => {
      const el = document.createElement('div');
      el.className = 'clip-item';
      el.textContent = text.length > 200 ? text.substring(0, 200) + '…' : text;

      el.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          el.classList.add('copied');
          const orig = el.textContent;
          el.textContent = '✓ Copied to clipboard';
          setTimeout(() => {
            el.textContent = orig;
            el.classList.remove('copied');
          }, 1200);
        } catch (e) {
          console.warn('CORTEX: Clipboard write failed', e);
        }
      });

      clipboardList.appendChild(el);
    });
  });
}

chrome.storage.onChanged.addListener((changes, ns) => {
  if (ns === 'local' && changes.cortex_clipboard) renderClipboard();
});

// ══════════════════════════════════════════════════════════════════
// FOCUS MODE
// ══════════════════════════════════════════════════════════════════
const toggleFocusBtn = document.getElementById('toggleFocusBtn');
const focusStatusText = document.getElementById('focusStatusText');
const smartFocusToggle = document.getElementById('smartFocusToggle');
const eyeBreakToggle = document.getElementById('eyeBreakToggle');
const newBlockSite = document.getElementById('newBlockSite');
const addBlockBtn = document.getElementById('addBlockBtn');
const blockedSitesList = document.getElementById('blockedSitesList');

let isFocusActive = false;
let blockedSites = [];

function updateFocusUI() {
  if (isFocusActive) {
    toggleFocusBtn.classList.add('active');
    toggleFocusBtn.textContent = 'STOP FOCUS SESSION';
    focusStatusText.textContent = 'ACTIVE — DEEP WORK';
    focusStatusText.style.color = '#ef4444';
  } else {
    toggleFocusBtn.classList.remove('active');
    toggleFocusBtn.textContent = 'START FOCUS SESSION';
    focusStatusText.textContent = 'OFF';
    focusStatusText.style.color = '';
  }
}

function renderBlockedSites() {
  blockedSitesList.innerHTML = '';
  blockedSites.forEach((site, i) => {
    const el = document.createElement('div');
    el.className = 'blocked-item';
    el.innerHTML = `<span>${site}</span><button data-i="${i}">×</button>`;
    el.querySelector('button').addEventListener('click', () => {
      blockedSites.splice(i, 1);
      chrome.storage.local.set({ cortex_blocked_sites: blockedSites });
      renderBlockedSites();
    });
    blockedSitesList.appendChild(el);
  });
}

// Load focus state
chrome.storage.local.get(['cortex_focus_active', 'cortex_blocked_sites', 'cortex_smart_focus', 'cortex_eye_break_enabled'], (res) => {
  isFocusActive = !!res.cortex_focus_active;
  blockedSites = res.cortex_blocked_sites || ['youtube.com', 'facebook.com', 'twitter.com', 'instagram.com', 'reddit.com', 'tiktok.com'];
  smartFocusToggle.checked = !!res.cortex_smart_focus;
  eyeBreakToggle.checked = res.cortex_eye_break_enabled !== false; // default on
  updateFocusUI();
  renderBlockedSites();
});

// Also listen for external focus activation (e.g. from Smart Focus in background)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.cortex_focus_active) {
    isFocusActive = !!changes.cortex_focus_active.newValue;
    updateFocusUI();
  }
});

toggleFocusBtn.addEventListener('click', () => {
  isFocusActive = !isFocusActive;
  chrome.storage.local.set({ cortex_focus_active: isFocusActive });
  updateFocusUI();
});

smartFocusToggle.addEventListener('change', () => {
  chrome.storage.local.set({ cortex_smart_focus: smartFocusToggle.checked });
});

eyeBreakToggle.addEventListener('change', () => {
  chrome.storage.local.set({ cortex_eye_break_enabled: eyeBreakToggle.checked });
});

addBlockBtn.addEventListener('click', () => {
  const site = newBlockSite.value.trim().toLowerCase();
  if (site && !blockedSites.includes(site)) {
    blockedSites.push(site);
    chrome.storage.local.set({ cortex_blocked_sites: blockedSites });
    renderBlockedSites();
    newBlockSite.value = '';
  }
});

// ══════════════════════════════════════════════════════════════════
// STATS — Domain Time Tracking
// ══════════════════════════════════════════════════════════════════
const domainStatsEl = document.getElementById('domainStats');

function renderDomainStats() {
  const today = new Date().toISOString().split('T')[0];
  chrome.storage.local.get(['cortex_domain_time'], (res) => {
    const data = res.cortex_domain_time || {};
    const todayData = data[today] || {};
    domainStatsEl.innerHTML = '';

    const entries = Object.entries(todayData).sort((a, b) => b[1] - a[1]);

    if (entries.length === 0) {
      domainStatsEl.innerHTML = '<div style="color:#94a3b8;text-align:center;padding:40px 20px;font-size:13px;">No browsing data yet today.<br>Stats update every minute.</div>';
      return;
    }

    const maxMinutes = entries[0][1];

    entries.forEach(([domain, minutes]) => {
      const el = document.createElement('div');
      el.className = 'domain-row';

      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      const barWidth = Math.max(5, (minutes / maxMinutes) * 100);

      el.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div class="domain-name">${domain}</div>
          <div class="domain-bar" style="width:${barWidth}%;"></div>
        </div>
        <div class="domain-time">${timeStr}</div>
      `;
      domainStatsEl.appendChild(el);
    });
  });
}

// ══════════════════════════════════════════════════════════════════
// SMART PAGE INFO — Reading Time Estimator
// ══════════════════════════════════════════════════════════════════
async function updateReadingTime() {
  const readingTimeEl = document.getElementById('readingTime');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      readingTimeEl.textContent = 'No data for this page';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_CONTENT" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.content) {
        readingTimeEl.textContent = 'Reading time unavailable';
        return;
      }

      const text = response.content;
      const words = text.trim().split(/\s+/).length;
      const minutes = Math.ceil(words / 200); // 200 wpm average
      readingTimeEl.textContent = `${minutes} min read (${words} words)`;
    });
  } catch (e) {
    readingTimeEl.textContent = 'Error calculating time';
  }
}

// Update when sidepanel opens
updateReadingTime();

// Update when switching tabs in Chrome
chrome.tabs.onActivated.addListener(updateReadingTime);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') updateReadingTime();
});

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════
renderClipboard();
