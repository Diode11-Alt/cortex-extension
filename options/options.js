document.getElementById('saveBtn').onclick = () => {
  const key = document.getElementById('apiKey').value;
  chrome.storage.local.set({ gemini_api_key: key }, () => alert('Saved'));
};
chrome.storage.local.get(['gemini_api_key'], r => { if(r.gemini_api_key) document.getElementById('apiKey').value = r.gemini_api_key; });
