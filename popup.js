document.addEventListener('DOMContentLoaded', async () => {
  await updateUsageUI();

  const { context_cache, provider } = await chrome.storage.local.get(['context_cache', 'provider']);
  const engineTag = document.getElementById('engineTag');
  
  if (context_cache) renderCache(context_cache);
  
  // 현재 설정된 엔진 표시
  if (provider && engineTag) engineTag.innerText = provider === 'auto' ? 'AUTO Mode' : `${provider.toUpperCase()} Mode`;

  // 설정 버튼: options 페이지 열기
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // [캐싱하기] 버튼 로직
  document.getElementById('readBtn').addEventListener('click', async () => {
    const readBtn = document.getElementById('readBtn');
    const { context_cache, last_read_length = 0 } = await chrome.storage.local.get(['context_cache', 'last_read_length']);

    readBtn.disabled = true;
    readBtn.innerText = '대화 추출 중...';

    try {
      const fullConversation = await getConversationContent();
      
      if (!fullConversation || fullConversation.length < 10) {
        throw new Error("페이지에서 대화 내용을 감지하지 못했습니다. AI 채팅창이 맞는지 확인해주세요.");
      }

      // [BM 핵심] 실행 계획(Plan) 수립: 사용량 체크 및 라우팅
      // 전체 대화가 아닌 '새로 추가될 내용'만으로 라우팅 결정 (비용 최적화)
      let startIdx = fullConversation.length < last_read_length ? 0 : last_read_length;
      const newContentPreview = fullConversation.substring(startIdx).trim();
      
      const plan = await Router.getExecutionPlan(newContentPreview);

      // 1. 제한 초과 처리
      if (plan.mode === 'LIMIT_EXCEEDED') {
        renderLimitExceededUI();
        throw new Error("무료 사용량을 초과했습니다.");
      }

      // [신규] API 키 미입력 처리
      if (plan.mode === 'NO_API_KEY') {
        const msg = plan.reason === 'length_fallback'
          ? `⚙️ 대화가 길어서 Gemini로 자동 전환됐는데 Gemini 키가 없습니다.\n설정 페이지에서 Gemini API 키도 함께 입력해주세요.`
          : `⚙️ '내 API 키 사용' 모드가 설정되어 있지만 키가 없습니다.\n설정 페이지(⚙️ 아이콘)에서 ${plan.provider.toUpperCase()} API 키를 입력해주세요.`;
        alert(msg);
        throw new Error("API 키가 없습니다.");
      }

      // [Diff 안정성 강화] 
      // 만약 새 대화창으로 이동해서 전체 길이가 줄어들었다면 last_read_length를 초기화합니다.
      if (fullConversation.length < last_read_length) {
        console.log("새로운 대화 세션 감지: 길이를 초기화합니다.");
        startIdx = 0;
      }

      const newContent = fullConversation.substring(startIdx).trim();

      if (newContent.length < 5) {
        alert("이미 최신 상태입니다. 새로 추가된 내용이 없습니다.");
        return;
      }

      readBtn.innerText = 'AI 분석 중 (증분 업데이트)...';
      
      // 3. AI 분석 실행 (Plan에서 결정된 Provider/Key 사용)
      const updatedCache = await updateContextCacheIncremental(newContent, context_cache, plan.provider, plan.apiKey);
      
      // 새로운 읽기 지점 저장
      await chrome.storage.local.set({ 
        context_cache: updatedCache, 
        last_read_length: fullConversation.length 
      });

      // 4. 성공 시 사용량 차감
      if (plan.mode === 'SYSTEM_PROXY') {
        const newCount = plan.currentUsage + 1;
        await chrome.storage.local.set({ usage_count: newCount });
        await updateUsageUI();
      }

      renderCache(updatedCache);
    } catch (e) {
      if (e.message !== "무료 사용량을 초과했습니다." && e.message !== "API 키가 없습니다.") {
        alert("에러: " + e.message);
      }
    } finally {
      readBtn.disabled = false;
      readBtn.innerText = '방금 나눈 대화 캐싱하기';
    }
  });

  // 3. [주입하기] 버튼: 현재 입력창 내용 기반 스마트 주입
  document.getElementById('injectBtn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Content Script가 로드되었는지 확인 (PING)
    chrome.tabs.sendMessage(tab.id, { action: "PING" }, async (response) => {
      if (chrome.runtime.lastError || !response) {
        alert("페이지가 준비되지 않았습니다. 새로고침(F5) 후 다시 시도해주세요.");
        return;
      }
      
      // 실제 주입 실행
      await executeInjection(tab.id);
    });
  });

  // 4. [초기화] 버튼: 로컬 스토리지 비우기
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (confirm("저장된 모든 프로젝트 맥락을 삭제할까요?")) {
      await chrome.storage.local.remove(['context_cache', 'last_read_length']);
      renderCache(null);
      alert("캐시가 초기화되었습니다.");
    }
  });
});

function renderLimitExceededUI() {
  const container = document.getElementById('status-container');
  if (container) {
    container.innerHTML = `
      <div style="background: #fff3e0; color: #e65100; padding: 10px; margin-bottom: 10px; border-radius: 8px; border: 1px solid #ffb74d; font-size: 12px; text-align: center;">
        <strong>⚠️ 일일 사용량 초과</strong><br>
        오늘의 무료 분석 횟수를 모두 사용했습니다. 내일 다시 이용해주세요.
      </div>
    `;
  }
}

async function updateUsageUI() {
  const { usage_count = 0, api_mode } = await chrome.storage.local.get(['usage_count', 'api_mode']);
  const usageContainer = document.querySelector('.usage-container');

  // 내 API 키 모드이면 사용량 게이지 숨김
  if (api_mode === 'own') {
    if (usageContainer) {
      usageContainer.innerHTML = `
        <div style="font-size:12px; color:#2e7d32; background:#e8f5e9; padding:8px 12px; border-radius:8px; text-align:center;">
          🔑 내 API 키 모드 — 사용량 제한 없음
        </div>`;
    }
    return;
  }

  const limit = 20;
  const percentage = Math.min((usage_count / limit) * 100, 100);
  const usageText = document.getElementById('usage-text');
  const progressFill = document.getElementById('progress-fill');
  if (usageText) usageText.innerText = `${usage_count} / ${limit}`;
  if (progressFill) progressFill.style.width = `${percentage}%`;
}

async function getConversationContent() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  
  if (!tab) return null;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 1. 각 AI 서비스별 최신 메시지 컨테이너 셀렉터
        const selectors = [
          '.font-claude-message',             // Claude 본문
          'div[data-testid="conversation-turn"]', // ChatGPT
          'div[data-message-author-role]',    // ChatGPT (New)
          '.message-content',                 // Gemini (New)
          'div[role="article"]',              // Gemini/General
          '.model-response-text',             // Gemini (Specific)
          '.contents'                         // General
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        
        // 2. 요소가 하나도 없을 경우의 Fallback (텍스트 기반 추출)
        if (elements.length === 0) {
          // 너무 짧은 div는 제외하고, 실제 대화가 담길 법한 긴 텍스트 div만 추출
          const allDivs = Array.from(document.querySelectorAll('div'));
          const probableChats = allDivs.filter(d => {
            const text = d.innerText || "";
            return text.length > 40 && d.children.length < 5;
          });
          return probableChats.map(el => el.innerText.trim()).join('\n\n');
        }

        // 3. 찾은 요소들을 배열로 변환하여 텍스트 합치기
        return Array.from(elements)
          .map(el => el.innerText.trim())
          .filter(text => text.length > 0) // 빈 텍스트 제거
          .join('\n\n');
      }
    });

    // 결과값이 없으면 null 반환 (iterable 에러 방지용)
    return (results && results[0] && results[0].result) ? results[0].result : null;
  } catch (e) {
    console.error("Script execution failed:", e);
    return null;
  }
}

async function updateContextCacheIncremental(newText, oldCache, provider, apiKey) {
  const JSON_SCHEMA = {
    global_state: "현재 프로젝트의 전체적인 목적과 진행 상황 요약",
    decisions: [{ decision: "결정사항", reason: "이유", importance: "high/medium/low" }],
    tasks: ["수행해야 할 작업 리스트"],
    code_state: {
      arch: "코드 구조 설명",
      modules: [{ name: "모듈명", desc: "설명", tags: ["태그"] }]
    }
  };

  const systemPrompt = `
    당신은 프로젝트 맥락 관리 엔진 'Context Cache'입니다.
    당신의 임무는 [기존 상태]를 바탕으로 [추가된 대화] 내용을 분석하여 지식 구조를 업데이트하는 것입니다.
    
    [업데이트 규칙]
    1. 중복된 결정사항(decisions)은 유지하되, 변경된 내용이 있다면 수정하세요.
    2. 새로운 작업(tasks)이나 모듈(modules)이 언급되었다면 리스트에 추가하세요.
    3. 프로젝트의 전체 상태(global_state)를 최신 흐름에 맞게 갱신하세요.
    4. 반드시 아래 JSON 스키마를 엄격히 준수하세요.
    
    [JSON SCHEMA]
    ${JSON.stringify(JSON_SCHEMA, null, 2)}

    [기존 상태]
    ${JSON.stringify(oldCache || {})}

    [추가된 대화]
    ${newText}
  `;

  try {
    // 이미 Plan 단계에서 Provider와 Key가 결정되어 넘어옴
    const engine = AI_STRATEGIES[provider];
    const resultText = await engine.analyze(systemPrompt, apiKey);
    
    // JSON 파싱 에러 방지를 위한 안정장치 (마크다운 코드블록 제거 등)
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const updatedCache = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(resultText);
    
    await chrome.storage.local.set({ context_cache: updatedCache });
    return updatedCache;
  } catch (e) {
    console.error("Context Cache 분석 실패:", e);
    throw new Error("AI 분석 중 오류가 발생했습니다: " + e.message);
  }
}

async function executeInjection(tabId) {
  const { context_cache } = await chrome.storage.local.get('context_cache');
  if (!context_cache) return alert("저장된 캐시가 없습니다. 먼저 분석을 진행해주세요.");

  try {
    // 현재 입력창에 쓰여진 글 읽기
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const input = document.querySelector('#prompt-textarea') || 
                      document.querySelector('div[contenteditable="true"]') ||
                      document.querySelector('textarea');
        return input ? (input.innerText || input.value) : "";
      }
    });

    const currentInputText = results[0]?.result || "";
    
    // engine.js의 로직을 사용하여 맥락 필터링 (비어있으면 전체 요약 위주)
    const relevantContext = selectRelevantContext(currentInputText || "general", context_cache);

    // Content Script로 주입 명령 전송
    chrome.tabs.sendMessage(tabId, {
      action: "INJECT_CONTEXT",
      context: relevantContext
    }, (response) => {
      if (response && response.status === "success") {
        window.close(); // 성공 시 팝업 닫음
      } else {
        alert("주입에 실패했습니다. 입력창을 찾을 수 없습니다.");
      }
    });
  } catch (err) {
    console.error("주입 프로세스 에러:", err);
  }
}

function renderCache(cache) {
  const globalElem = document.getElementById('global-state');
  const dList = document.getElementById('decisions-list');
  const tList = document.getElementById('tasks-list');
  const codeArchElem = document.getElementById('code-arch');
  const codeModulesListElem = document.getElementById('code-modules-list');

  if (!cache) {
    if(globalElem) globalElem.innerText = '아직 분석된 내용이 없습니다.';
    if(dList) dList.innerHTML = '<li>내역 없음</li>';
    if(tList) tList.innerHTML = '<li>내역 없음</li>';
    if(codeArchElem) codeArchElem.innerText = '';
    if(codeModulesListElem) codeModulesListElem.innerHTML = '';
    return;
  }
  
  globalElem.innerText = cache.global_state || '미지정';
  dList.innerHTML = (cache.decisions || []).map(d => 
    `<li><strong style="color:#0047AB;">${d.decision}</strong><br><small style="color:#666">${d.reason}</small></li>`
  ).join('') || '<li>내역 없음</li>';
  
  tList.innerHTML = (cache.tasks || []).map(t => `<li>${t}</li>`).join('') || '<li>내역 없음</li>';

  if (codeArchElem) codeArchElem.innerText = cache.code_state?.arch || '분석 전';
  if (codeModulesListElem) {
    codeModulesListElem.innerHTML = (cache.code_state?.modules || []).map(m => 
      `<li><strong style="color:#00838f;">${m.name}</strong>: ${m.desc}</li>`
    ).join('') || '<li>모듈 정보 없음</li>';
  }
}