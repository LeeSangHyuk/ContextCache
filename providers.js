// providers.js - AI 엔진 추상화 레이어

const SYSTEM_CONFIG = {
  FREE_LIMIT: 20, // 하루 무료 분석 횟수
  DEFAULT_KEY: "system-proxy" // popup.js의 키 체크를 통과하기 위한 내부 식별자
};

// 1. Router 객체 정의 (최상단으로 이동)
// export 키워드 제거 (전역에서 접근 가능하도록)
const Router = {
  // Cloudflare Worker 주소
  PROXY_URL: "https://context-cache-proxy.lshprid.workers.dev",

  // 엔진 결정 로직 (1500자 기준)
  determineProvider(text, userPreference) {
    if (userPreference === 'auto') {
      return text.length > 1500 ? 'gemini' : 'groq';
    }
    return userPreference || 'gemini';
  },

  // 실행 계획 수립 (popup.js에서 사용)
  async getExecutionPlan(text) {
    // 사용량 체크 로직
    const today = new Date().toLocaleDateString();
    const { usage_count = 0, last_reset_date } = await chrome.storage.local.get(['usage_count', 'last_reset_date']);
    let currentUsage = usage_count;
    if (last_reset_date !== today) {
      currentUsage = 0;
      await chrome.storage.local.set({ usage_count: 0, last_reset_date: today });
    }

    // 사용량 제한 체크
    if (currentUsage >= SYSTEM_CONFIG.FREE_LIMIT) {
      return { mode: 'LIMIT_EXCEEDED' };
    }

    // 텍스트 길이에 따라 모델만 내부적으로 자동 할당
    const recommendedProvider = text.length > 1500 ? 'gemini' : 'groq';

    return {
        mode: 'SYSTEM_PROXY', // 개인 키가 아닌 시스템 프록시 사용 명시
        provider: recommendedProvider,
        apiKey: SYSTEM_CONFIG.DEFAULT_KEY, // 미리 정의된 시스템 키 사용
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
  const response = await fetch(Router.PROXY_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-client-id': await getOrCreateClientId()
    },
    body: JSON.stringify({ prompt, provider })
  });

  if (!response.ok) {
    throw new Error(`Proxy Error: ${response.status}`);
  }

  const data = await response.json();
  return provider === 'gemini' ? data.candidates[0].content.parts[0].text : data.choices[0].message.content;
}

class AIProvider {
  async analyze(prompt, apiKey) {
    throw new Error("analyze() 메소드를 구현해야 합니다.");
  }
}

class GeminiProvider extends AIProvider {
  constructor(model = 'gemini-3-flash-preview') {
    super();
    // 모델명 앞에 'models/'가 없다면 붙여줍니다. (API 규격 준수)
    this.model = model.startsWith('models/') ? model : `models/${model}`;
  }

  async analyze(prompt, apiKey) {
    // Default Key(시스템 프록시 모드)인 경우 프록시 호출
    if (!apiKey || apiKey === SYSTEM_CONFIG.DEFAULT_KEY) {
      return callProxy(prompt, 'gemini');
    }

    // 사용자 키가 있는 경우 직접 호출
    return this.callDirectly(prompt, apiKey);
  }

  async callDirectly(prompt, apiKey) {
    // 가이드 문서 권장: v1beta 엔드포인트 사용
    // API Key를 URL 파라미터가 아닌 URL 경로에서 제거하고 깔끔하게 유지합니다.
    const url = `https://generativelanguage.googleapis.com/v1beta/${this.model}:generateContent`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey // API Key를 헤더로 전송 (보안 및 호환성 강화)
      },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: prompt }] 
        }],
        generationConfig: { 
          temperature: 0.1, 
          // 응답을 반드시 JSON 객체로 받기 위한 설정
          responseMimeType: "application/json" 
        }
      })
    });
    
    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error Detail:", data.error);
      // 모델을 찾을 수 없는 경우(404)에 대한 사용자 친화적 메시지
      if (data.error.code === 404) {
        throw new Error(`모델 '${this.model}'을 찾을 수 없습니다. API 설정에서 모델명을 확인하세요.`);
      }
      throw new Error(data.error.message);
    }

    // 결과 텍스트 반환
    if (data.candidates && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error("AI로부터 유효한 응답을 받지 못했습니다.");
  }
}

class GroqProvider extends AIProvider {
  constructor(model = 'llama3-70b-8192') {
    super();
    this.model = model;
  }

  async analyze(prompt, apiKey) {
    // Default Key(시스템 프록시 모드)인 경우 프록시 호출
    if (!apiKey || apiKey === SYSTEM_CONFIG.DEFAULT_KEY) {
      return callProxy(prompt, 'groq');
    }

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Groq API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// 전역 변수로 선언하여 popup.js에서 접근 가능하게 함
const AI_STRATEGIES = {
  gemini: new GeminiProvider(),
  groq: new GroqProvider()
};