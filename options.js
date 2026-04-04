let currentMode = 'system';

document.addEventListener('DOMContentLoaded', async () => {
  const { api_mode, own_provider, groq_api_key, gemini_api_key } =
    await chrome.storage.local.get(['api_mode', 'own_provider', 'groq_api_key', 'gemini_api_key']);

  if (api_mode === 'own') {
    switchMode('own');
    if (own_provider) document.getElementById('ownProvider').value = own_provider;
    if (groq_api_key) document.getElementById('groqKey').value = groq_api_key;
    if (gemini_api_key) document.getElementById('geminiKey').value = gemini_api_key;
    onProviderChange();
  }

  document.getElementById('btnSystem').addEventListener('click', () => switchMode('system'));
  document.getElementById('btnOwn').addEventListener('click', () => switchMode('own'));
  document.getElementById('ownProvider').addEventListener('change', onProviderChange);
  document.getElementById('toggleGroqKey').addEventListener('click', () => toggleVisibility('groqKey'));
  document.getElementById('toggleGeminiKey').addEventListener('click', () => toggleVisibility('geminiKey'));
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});

function switchMode(mode) {
  currentMode = mode;
  document.getElementById('btnSystem').classList.toggle('active', mode === 'system');
  document.getElementById('btnOwn').classList.toggle('active', mode === 'own');
  document.getElementById('systemInfo').classList.toggle('visible', mode === 'system');
  document.getElementById('apiSection').classList.toggle('visible', mode === 'own');
}

function onProviderChange() {
  const provider = document.getElementById('ownProvider').value;
  document.getElementById('groqGroup').style.display = provider === 'groq' ? 'block' : 'none';
  document.getElementById('geminiGroup').style.display = provider === 'gemini' ? 'block' : 'none';
}

function toggleVisibility(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveSettings() {
  if (currentMode === 'own') {
    const provider = document.getElementById('ownProvider').value;
    const groqKey = document.getElementById('groqKey').value.trim();
    const geminiKey = document.getElementById('geminiKey').value.trim();

    if (provider === 'groq' && !groqKey) return showToast('Groq API 키를 입력해주세요.', 'error');
    if (provider === 'groq' && !groqKey.startsWith('gsk_')) return showToast('Groq 키는 gsk_ 로 시작해야 합니다.', 'error');
    if (provider === 'gemini' && !geminiKey) return showToast('Gemini API 키를 입력해주세요.', 'error');
    if (provider === 'gemini' && !geminiKey.startsWith('AIza')) return showToast('Gemini 키는 AIza 로 시작해야 합니다.', 'error');

    await chrome.storage.local.set({
      api_mode: 'own',
      own_provider: provider,
      groq_api_key: groqKey,
      gemini_api_key: geminiKey,
    });
  } else {
    await chrome.storage.local.set({ api_mode: 'system' });
  }

  showToast('✅ 설정이 저장되었습니다!', 'success');
}

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type}`;
  toast.innerText = msg;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}
