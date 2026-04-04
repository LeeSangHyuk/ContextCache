// providers.js - AI 엔진 추상화 레이어

const SYSTEM_CONFIG = {
  FREE_LIMIT: 20,
  DEFAULT_KEY: "system-proxy"
};

// Router 객체 (전역 등록)
window.Router = {
  PROXY_URL: "https://context-cache-proxy.lshprid.workers.dev",

  determineProvider(text, userPreference) {
    const textLength = (text || "").length;
    // 1500자 초과 시 무조건 Gemini (안정성 확보)
    if (textLength > 1500) {
      console.warn(`[Router] 길이(${textLength})로 인한 Gemini 강제 전환`);
      return 'gemini';
    }
    if (!userPreference || userPreference === 'auto') return 'groq';
    return userPreference;
  },

  async getExecutionPlan(text) {
    const textLength = (text || "").length;
    if (textLength > 100000) return { mode: 'TEXT_TOO_LARGE', length: textLength };

    // [신규] 사용자 API 키 모드 우선 확인
    const { api_mode, own_provider, groq_api_key, gemini_api_key } =
      await chrome.storage.local.get(['api_mode', 'own_provider', 'groq_api_key', 'gemini_api_key']);

    if (api_mode === 'own') {
      const preferredProvider = own_provider || 'groq';
      // 길이 기반 자동 라우팅 (시스템 모드와 동일한 기준)
      const actualProvider = this.determineProvider(text, preferredProvider);

      // 실제 사용할 provider의 키 결정
      const apiKey = actualProvider === 'gemini' ? gemini_api_key : groq_api_key;

      if (!apiKey) {
        // Groq 선택했는데 길어서 Gemini로 전환됐는데 Gemini 키가 없는 경우
        if (actualProvider === 'gemini' && preferredProvider === 'groq') {
          return { mode: 'NO_API_KEY', provider: 'gemini', reason: 'length_fallback' };
        }
        return { mode: 'NO_API_KEY', provider: actualProvider };
      }

      return {
        mode: 'OWN_KEY',
        provider: actualProvider,
        apiKey,
        currentUsage: null
      };
    }

    // 시스템 프록시 모드 (기존 로직)
    const today = new Date().toLocaleDateString();
    const { usage_count = 0, last_reset_date } =
      await chrome.storage.local.get(['usage_count', 'last_reset_date']);

    let currentUsage = usage_count;
    if (last_reset_date !== today) {
      currentUsage = 0;
      await chrome.storage.local.set({ usage_count: 0, last_reset_date: today });
    }

    if (currentUsage >= SYSTEM_CONFIG.FREE_LIMIT) return { mode: 'LIMIT_EXCEEDED' };

    const recommendedProvider = this.determineProvider(text, 'auto');
    return {
      mode: 'SYSTEM_PROXY',
      provider: recommendedProvider,
      apiKey: SYSTEM_CONFIG.DEFAULT_KEY,
      currentUsage
    };
  }
};

async function getOrCreateClientId() {
  const { client_id } = await chrome.storage.local.get('client_id');
  if (client_id) return client_id;
  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ client_id: newId });
  return newId;
}

async function callProxy(prompt, provider) {
  try {
    const response = await fetch(window.Router.PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': await getOrCreateClientId()
      },
      body: JSON.stringify({ prompt, provider })
    });

    if (!response.ok) {
      throw new Error(`Proxy 서버 응답 오류 (${response.status})`);
    }

    const data = await response.json();
    let resultText = (provider === 'gemini')
      ? data?.candidates?.[0]?.content?.parts?.[0]?.text
      : data?.choices?.[0]?.message?.content;

    // Groq 결과 없으면 Gemini로 fallback
    if (!resultText || resultText.trim() === "") {
      if (provider === 'groq') {
        console.warn("Groq 엔진 응답 없음. Gemini로 자동 Fallback 시도...");
        return await callProxy(prompt, 'gemini');
      }
      throw new Error(`${provider.toUpperCase()} 엔진 응답 데이터 누락`);
    }

    return resultText;
  } catch (error) {
    if (provider === 'groq') {
      console.error("Groq 호출 실패, Gemini로 전환합니다:", error);
      return await callProxy(prompt, 'gemini');
    }
    throw error;
  }
}

class GeminiProvider {
  constructor(model = 'gemini-3-flash-preview') {
    this.model = model.startsWith('models/') ? model : `models/${model}`;
  }

  async analyze(prompt, apiKey) {
    // 시스템 프록시 모드
    if (!apiKey || apiKey === SYSTEM_CONFIG.DEFAULT_KEY) {
      return callProxy(prompt, 'gemini');
    }

    // [신규] 직접 Gemini API 호출
    const url = `https://generativelanguage.googleapis.com/v1beta/${this.model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Gemini API 오류: ${err?.error?.message || response.status}`);
    }

    const data = await response.json();
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("Gemini API 응답 데이터 누락");
    return resultText;
  }
}

class GroqProvider {
  constructor(model = 'llama-3.3-70b-versatile') {
    this.model = model;
  }

  async analyze(prompt, apiKey) {
    // 시스템 프록시 모드
    if (!apiKey || apiKey === SYSTEM_CONFIG.DEFAULT_KEY) {
      return callProxy(prompt, 'groq');
    }

    // [신규] 직접 Groq API 호출
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Groq API 오류: ${err?.error?.message || response.status}`);
    }

    const data = await response.json();
    const resultText = data?.choices?.[0]?.message?.content;
    if (!resultText) throw new Error("Groq API 응답 데이터 누락");
    return resultText;
  }
}

window.AI_STRATEGIES = {
  gemini: new GeminiProvider(),
  groq: new GroqProvider()
};
