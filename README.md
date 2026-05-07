# CORTEX OS v3.0

CORTEX is a high-performance Productivity OS built as a Chrome Extension. It centralizes your browsing workflow by combining smart tab management, a professional multi-note notebook, a secure clipboard vault, and automated deep-work focus tools.

![CORTEX Logo](icons/icon128.png)

## 🚀 Key Features

### 1. 🧠 Smart Notebook
- **Topic-Based Organization**: Group your notes by topic for easy retrieval.
- **IDE-Grade Editor**: Features line numbers, plain-text focus, and a ruled-paper aesthetic.
- **Live Search**: Search across all your notes by topic or content instantly.
- **Stats & Utilities**: Word counts, character counts, and one-click copy to clipboard.

### 2. 🛡️ Deep Work Focus Mode
- **Smart Focus**: Automatically detects productive patterns and enables site blocking after 5 minutes of work.
- **Custom Blocklist**: Easily manage which sites distract you.
- **Stay Focused Screen**: A premium, minimalist blocker that protects your flow.

### 3. 📑 Intelligent Tab Management
- **Smart Hibernation**: Automatically discards inactive tabs after 30 minutes to save RAM.
- **Protection Engine**: Automatically whitelists your top 5 most important/frequent tabs.
- **Countdown Warning**: Non-intrusive banners warn you before a tab hibernates.

### 4. 📋 Clipboard Vault
- **Local Persistence**: Every text selection you copy is saved to a secure local vault.
- **One-Click Re-Copy**: Quickly access and re-copy previous clips without digging through history.

### 5. 📊 Productivity Analytics
- **Domain Time Tracking**: See a bar chart of exactly where your time goes each day.
- **Eye Break Reminders**: Automated 20-20-20 rule notifications to protect your vision.
- **Reading Time Estimator**: See how long it will take to read any article before you start.

## 🛠️ Installation

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (toggle in the top right).
4. Click **Load unpacked** and select the extension directory.

## 📁 Project Structure

```text
├── background.js       # Core logic (Alarms, Focus, Tab Management)
├── manifest.json       # Extension configuration
├── sidepanel/          # Main Productivity UI
│   ├── sidepanel.html
│   ├── sidepanel.js
│   └── sidepanel.css
├── popup/              # Dashboard UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/            # Injected scripts & UI
│   ├── content.js
│   └── content.css
└── icons/              # Assets
```

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.
