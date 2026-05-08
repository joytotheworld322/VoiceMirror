export async function generateFeedback(sessionAnalysis, patternAnalysis, rawSession = null) {
  const silentRatio = sessionAnalysis.stateRatio?.silent ?? 1;
  const voicedPercent = ((1 - silentRatio) * 100).toFixed(0);
  const hasPattern = patternAnalysis && !patternAnalysis.insufficient;
  const nickname = localStorage.getItem('vm_nickname') || '';
  
  const halfDiff = sessionAnalysis.halfStats?.halfDiff || 0;
  const ambientLevelMap = {
    quiet: "조용한 환경",
    normal: "보통 환경",
    loud: "시끄러운 환경"
  };
  const ambientLevel = ambientLevelMap[sessionAnalysis.ambientLevel] || "보통 환경";
  const usedRecal = (rawSession?.sessionComfortLevel || sessionAnalysis.sessionComfortLevel) !== null;

  const vocalLoad = sessionAnalysis.vocalLoadSeconds || 0;
  const lombard = sessionAnalysis.lombardRatio || 0;
  const variability = sessionAnalysis.vocalVariability || 0;
  
  const userPrompt = `${nickname ? `사용자 이름: ${nickname}\n` : ''}
오늘 세션 정보:
- 발화 비율: ${voicedPercent}%
- 성대 주의 구간: ${vocalLoad}초
- 소음 대비 목소리 상승폭: ${lombard.toFixed(1)}
- 목소리 변동성: ${variability.toFixed(1)}
- 세션 전반 대비 후반 볼륨 변화: ${halfDiff > 0 ? '+' : ''}${halfDiff.toFixed(1)}dB
- 오늘 환경: ${ambientLevel}`;

  const systemPrompt = `당신은 발화 데이터를 분석해서 사용자에게 실용적인 피드백을 주는 코치입니다.`;

  // --- 로컬 분석 로직 (API 실패 시 사용) ---
  const getLocalFeedback = () => {
    let msg = nickname ? `${nickname}님, ` : "";
    
    if (vocalLoad > 10) {
      msg += "오늘 성대를 꽤 많이 사용하셨네요. 대화 중간에 물을 자주 마시고 목을 휴식시켜주는 것이 좋겠습니다. ";
    } else if (lombard > 15) {
      msg += "주변 소음 때문에 목소리가 평소보다 많이 커졌어요. 목에 무리가 갈 수 있으니 조금 더 조용한 곳에서 대화해보는 건 어떨까요? ";
    } else if (halfDiff > 5) {
      msg += "대화가 진행될수록 목소리에 힘이 점점 더 들어가고 있어요. 호흡을 조금 더 깊게 가져가 보세요. ";
    } else {
      msg += "전반적으로 목소리를 아주 편안하고 일정하게 유지하고 계시네요! 지금처럼 좋은 습관을 유지해 보세요. ";
    }
    
    msg += "\n\n오늘 목 상태는 어떠신가요?";
    return msg;
  };

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: systemPrompt, userPrompt: userPrompt })
    });

    if (!response.ok) throw new Error("API not available");

    const data = await response.json();
    return data.content?.[0]?.text || data.text || getLocalFeedback();
  } catch (error) {
    console.warn("AI API unavailable, using local analysis:", error);
    // API 서버가 없거나 에러가 나면 로컬 룰 기반 피드백 반환
    return getLocalFeedback();
  }
}
