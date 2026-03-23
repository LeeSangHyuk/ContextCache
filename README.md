# Context Cache v1.0.0

**Context Cache: AI 대화의 흐름을 잃지 않는 스마트 비서**

여러 AI와 대화하다 보면 이전의 맥락을 매번 다시 설명하기 번거로우셨나요? Context Cache는 당신의 이전 대화 맥락을 지능적으로 요약하고 저장하여, 필요할 때 즉시 입력창에 다시 주입해 줍니다.

*   **스마트 라우팅:** 긴 대화는 Gemini, 빠른 분석은 Groq로 자동 할당하여 최적의 분석 결과를 제공합니다.
*   **간편한 사용:** 별도의 설정 없이 버튼 하나로 AI의 기억력을 되살리세요.
*   **개인정보 보호:** 시스템 프록시를 통해 안전하게 처리되며, 대화 내용은 저장되지 않습니다.

---

## English Description

**Context Cache: Never lose your AI conversation flow again.**

Tired of re-explaining context every time you start a new chat? Context Cache intelligently summarizes and stores your conversation context, reinjecting it into your AI chat inputs whenever you need it.

*   **Smart Routing:** Automatically switches between Gemini and Groq for the most efficient analysis.
*   **Zero Config:** Install and use immediately with our optimized system proxy.
*   **Privacy Focused:** Your data is processed securely through our proxy and never stored.

## 📂 File Structure
- `manifest.json`: Extension settings and permissions (Storage, Scripting)
- `popup.html`: Cache dashboard and collection interface
- `popup.js`: UI event handling and main business logic
- `options.html`: System mode guide page (no user settings required)
- `engine.js`: Logic to filter the appropriate context from the stored cache for the current question
- `content.js`: Securely injects context text by accessing the DOM of web pages (ChatGPT, Claude, etc.)

## 🛠 Installation and Usage
1.  Access your browser's extension manager (`edge://extensions` or `chrome://extensions`).
2.  Enable **Developer mode**.
3.  Click **Load unpacked** and select this folder.
4.  Ready to use without any additional setup.
5.  In the AI chat window, execute **[Cache Last Conversation]** or **[Inject Context]**.
