// content.js
console.log("Context Cache: Content Script Loaded");

function injectAtCursor(text, inputField) {
  inputField.focus();
  const contextBlock = `\n---\n[CONTEXT CACHE]\n${text}\n---\n\n`;
  
  try {
    // React 등 현대적인 웹 앱의 입력창 상태와 동기화하기 위한 가장 안전한 방법
    if (!document.execCommand('insertText', false, contextBlock)) {
      throw new Error("execCommand failed");
    }
  } catch (e) {
    // Fallback 로직
    if (inputField.isContentEditable) {
      inputField.innerText += contextBlock;
    } else {
      const start = inputField.selectionStart;
      inputField.value = inputField.value.substring(0, start) + contextBlock + inputField.value.substring(start);
    }
  }

  // 상태 업데이트 이벤트 발생
  ['input', 'change'].forEach(name => {
    inputField.dispatchEvent(new Event(name, { bubbles: true, composed: true }));
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING") {
    sendResponse({ status: "alive" });
  } else if (request.action === "INJECT_CONTEXT") {
    const inputField = document.querySelector('textarea, div[contenteditable="true"], #prompt-textarea');
    if (inputField) {
      injectAtCursor(request.context, inputField);
      sendResponse({ status: "success" });
    } else {
      sendResponse({ status: "fail", message: "입력창을 찾을 수 없습니다." });
    }
  }
  return true; 
});