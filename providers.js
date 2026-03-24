// providers.js - AI 엔진 추상화 레이어 (최종 수정본)

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

    const today = new Date().toLocaleDateString();
    const { usage_count = 0, last_reset_date } = await chrome.storage.local.get(['usage_count', 'last_reset_date']);
    
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

    // [핵심] 만약 Groq 결과가 없거나 비어있다면 Gemini로 즉시 재시도
    if (!resultText || resultText.trim() === "") {
      if (provider === 'groq') {
        console.warn("Groq 엔진 응답 없음. Gemini로 자동 Fallback 시도...");
        return await callProxy(prompt, 'gemini'); // 자기 자신을 다시 호출 (Gemini로)
      }
      throw new Error(`${provider.toUpperCase()} 엔진 응답 데이터 누락`);
    }

    return resultText;
  } catch (error) {
    // 만약 Groq 호출 자체가 네트워크 에러 등으로 실패한 경우에도 Gemini 시도
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
    if (!apiKey || apiKey === SYSTEM_CONFIG.DEFAULT_KEY) return callProxy(prompt, 'gemini');
    // 직접 호출 로직...
  }
}

class GroqProvider {
  constructor(model = 'llama3-70b-8192') {
    this.model = model;
  }
  async analyze(prompt, apiKey) {
    if (!apiKey || apiKey === SYSTEM_CONFIG.DEFAULT_KEY) return callProxy(prompt, 'groq');
    
    // [수정] 직접 호출 시에도 JSON 모드 강제 적용
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" } 
      })
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }
}

window.AI_STRATEGIES = {
  gemini: new GeminiProvider(),
  groq: new GroqProvider()
};