# Privacy Policy for Context Cache

**Last Updated: April 4, 2026**

Context Cache ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Chrome Extension.

---

### 1. Data Collection and Usage

Context Cache accesses and processes the following data to provide its core functionality:

- **Web Content:** We access text from AI chat platforms (ChatGPT, Claude, Gemini) solely to summarize and maintain your conversation context.
- **User-Generated Content:** Summaries and structured context (decisions, tasks, code architecture) are generated based on the chat history you choose to cache.

---

### 2. Data Storage and Retention

- **Local Storage:** All structured context data (summaries, decisions, tasks) is stored **strictly on your local device** using the Chrome Storage API.
- **No Account Required:** We do not collect your name, email, or any personally identifiable information.
- **Retention:** Cached data remains on your device until you manually clear it via the "캐시 초기화" button or uninstall the extension.

---

### 3. Data Processing — External Services (Important)

To perform AI-powered summarization, **conversation text is transmitted to an external processing pipeline** when you click the "방금 나눈 대화 캐싱하기" button. This process works as follows:

1. **Cloudflare Workers Proxy:** Your conversation text is sent to our intermediary proxy server (`context-cache-proxy.lshprid.workers.dev`), hosted on Cloudflare's infrastructure. This proxy does **not permanently store** your conversation content.
2. **Third-Party AI APIs:** The proxy forwards the text to one of the following AI services for analysis:
   - **Groq API** (model: `llama3-70b-8192`) — used for shorter conversations
   - **Google Gemini API** (model: `gemini-3-flash-preview`) — used for longer conversations

These third-party services process your text under their own privacy policies:
- [Groq Privacy Policy](https://groq.com/privacy-policy/)
- [Google Privacy Policy](https://policies.google.com/privacy)

A **anonymous client ID** (randomly generated UUID) is attached to each request for rate-limiting purposes only. This ID is not linked to your identity.

---

### 4. What We Do NOT Do

- ❌ We do not sell, trade, or share your data with advertisers or third parties beyond the AI processing services described above.
- ❌ We do not use analytics or tracking scripts to monitor your browsing behavior.
- ❌ We do not store your conversation content on our servers after AI processing is complete.
- ❌ We do not sync your data to any cloud database.

---

### 5. Security

- All requests to our proxy are made over HTTPS.
- Your cached context is stored locally in Chrome's sandboxed storage and is not accessible to other extensions or websites.

---

### 6. Changes to This Policy

We may update this Privacy Policy as the extension evolves. Material changes will be reflected in the "Last Updated" date above.

---

### 7. Contact

If you have any questions regarding this Privacy Policy, please contact us via the email provided in the Chrome Web Store Developer Dashboard.