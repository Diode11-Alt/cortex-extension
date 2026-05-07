console.log("CORTEX OS Content Script Loaded.");

document.addEventListener('copy', () => {
  // Primary method: Get currently selected text (avoids permission prompts)
  const selection = window.getSelection().toString();
  if (selection && selection.trim().length > 0) {
    chrome.runtime.sendMessage({ 
      type: "CLIPBOARD_COPY", 
      text: selection.trim() 
    });
    return;
  }
  
  // Fallback: programmatic clipboard read (may fail due to permissions)
  setTimeout(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        chrome.runtime.sendMessage({ 
          type: "CLIPBOARD_COPY", 
          text: text.trim() 
        });
      }
    } catch (err) {
      console.log("CORTEX: Could not read clipboard natively.");
    }
  }, 100);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXTRACT_PAGE_CONTENT") {
    const mainText = document.body.innerText.substring(0, 5000);
    sendResponse({ content: mainText });
  }
});
