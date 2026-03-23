// engine.js
function selectRelevantContext(userQuestion, cache) {
  if (!cache) return "저장된 맥락이 없습니다.";
  
  const query = (userQuestion || "").toLowerCase();
  let context = `[Project Context: ${cache.global_state || "분석 전"}]\n`;

  // 1. 중요도가 'high'인 결정사항 포함
  const highDecisions = (cache.decisions || []).filter(d => d.importance === 'high');
  if (highDecisions.length > 0) {
    context += `\n[Critical Decisions]:\n` + highDecisions.map(d => `- ${d.decision}`).join('\n');
  }

  // 2. 키워드 매칭 (태그 및 모듈명 기반)
  if (cache.code_state && cache.code_state.modules) {
    const relatedModules = cache.code_state.modules.filter(m => 
      query.includes(m.name.toLowerCase()) || (m.tags && m.tags.some(t => query.includes(t.toLowerCase())))
    );
    
    if (relatedModules.length > 0) {
      context += `\n\n[Relevant Modules]:\n` + relatedModules.map(m => `- ${m.name}: ${m.desc}`).join('\n');
    }
  }

  return context;
}