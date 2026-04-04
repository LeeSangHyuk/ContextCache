# Context Cache v1.1.0

**Context Cache: AI 대화의 흐름을 잃지 않는 스마트 비서**

여러 AI와 대화하다 보면 이전의 맥락을 매번 다시 설명하기 번거로우셨나요? Context Cache는 당신의 이전 대화 맥락을 지능적으로 요약하고 저장하여, 필요할 때 즉시 입력창에 다시 주입해 줍니다.

- **증분 업데이트:** 대화 전체가 아닌 새로 추가된 내용만 분석하여 맥락을 누적 갱신합니다.
- **스마트 라우팅:** 짧은 대화는 Groq(빠름), 긴 대화는 Gemini로 자동 전환합니다.
- **내 API 키 지원:** 본인의 Groq / Gemini API 키를 직접 입력해 무제한으로 사용할 수 있습니다.
- **간편한 사용:** 버튼 하나로 맥락을 캐싱하고, 다른 AI 서비스에 즉시 주입합니다.
- **개인정보 보호:** 모든 캐시 데이터는 로컬에만 저장됩니다.

---

## English Description

**Context Cache: Never lose your AI conversation flow again.**

Tired of re-explaining context every time you start a new chat? Context Cache intelligently summarizes and stores your conversation context, reinjecting it into your AI chat inputs whenever you need it.

- **Incremental Updates:** Only newly added content is analyzed and merged into the existing cache.
- **Smart Routing:** Short conversations use Groq (fast), long ones automatically switch to Gemini.
- **Own API Key Support:** Use your own Groq / Gemini API key for unlimited usage with no daily cap.
- **One-Click Inject:** Cache your context and inject it into any supported AI service instantly.
- **Privacy First:** All cached data is stored strictly on your local device.

---

## 📂 File Structure

| File | Description |
|------|-------------|
| `manifest.json` | Extension settings and permissions |
| `popup.html` | Cache dashboard UI |
| `popup.js` | Main business logic and UI event handling |
| `options.html` | Settings page (API mode, key input) |
| `options.js` | Settings page logic |
| `engine.js` | Context filtering logic for smart injection |
| `content.js` | DOM injection into ChatGPT, Claude, Gemini |
| `providers.js` | AI engine abstraction (Groq, Gemini, proxy routing) |

---

## 🛠 Installation

1. `chrome://extensions` 또는 `edge://extensions` 접속
2. **개발자 모드** 활성화
3. **압축 해제된 확장 프로그램 로드** 클릭 후 이 폴더 선택
4. 설치 완료 — 별도 설정 없이 바로 사용 가능

---

## 🚀 Usage

1. ChatGPT, Claude, Gemini 중 하나에서 대화 진행
2. 익스텐션 팝업 열기 → **"방금 나눈 대화 캐싱하기"** 클릭
3. 다른 AI 서비스로 이동 후 → **"⚡ 현재 맥락 주입하기"** 클릭
4. 맥락이 입력창에 자동 삽입됨

---

## ⚙️ API Mode

| 모드 | 설명 | 일일 제한 |
|------|------|-----------|
| System (기본) | 시스템 프록시를 통해 Groq/Gemini 자동 할당 | 20회 |
| 내 API 키 | 본인 Groq 또는 Gemini 키 직접 입력 | 제한 없음 |

**무료 API 키 발급:**
- Groq: [console.groq.com/keys](https://console.groq.com/keys)
- Gemini: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

---

## 📋 Changelog

### v1.1.0
- 🔑 사용자 API 키 직접 입력 기능 추가 (Groq / Gemini)
- 🔄 내 API 키 모드에서도 길이 기반 자동 Gemini 전환 적용
- 🤖 Groq 모델 업데이트: `llama3-70b-8192` → `llama-3.3-70b-versatile`
- ⚙️ 설정 버튼(⚙️) 팝업에 추가
- 🔒 Privacy Policy 외부 서비스 경유 사실 명시
- 🐛 Manifest V3 CSP 위반 수정 (인라인 스크립트 → 외부 파일 분리)
- 🐛 `tabs` 권한 추가

### v1.0.0
- 최초 릴리즈
- 대화 캐싱 및 맥락 주입 기능
- Groq / Gemini 스마트 라우팅
- 증분 업데이트 (diff 기반)