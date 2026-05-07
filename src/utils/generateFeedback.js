/**
 * VITE_ANTHROPIC_API_KEY environment variable required.
 */

export async function generateFeedback(sessionAnalysis, patternAnalysis, rawSession = null) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing VITE_ANTHROPIC_API_KEY");
  }

  const voicedPercent = ((1 - sessionAnalysis.stateRatio.silent) * 100).toFixed(0);
  const hasPattern = !patternAnalysis.insufficient;
  const nickname = localStorage.getItem('vm_nickname') || '';
  
  const halfDiff = sessionAnalysis.halfStats?.halfDiff || 0;
  const ambientLevelMap = {
    quiet: "조용한 환경",
    normal: "보통 환경",
    loud: "시끄러운 환경"
  };
  const ambientLevel = ambientLevelMap[sessionAnalysis.ambientLevel];
  const usedRecal = (rawSession?.sessionComfortLevel || sessionAnalysis.sessionComfortLevel) !== null;

  const userPrompt = `${nickname ? `사용자 이름: ${nickname}\n` : ''}
오늘 세션 정보:
- 발화 비율: ${voicedPercent}%
- 성대 주의 구간: ${sessionAnalysis.vocalLoadSeconds}초
- 소음 대비 목소리 상승폭: ${sessionAnalysis.lombardRatio.toFixed(1)}
- 목소리 변동성: ${sessionAnalysis.vocalVariability.toFixed(1)}
- 세션 전반 대비 후반 볼륨 변화: ${halfDiff > 0 ? '+' : ''}${halfDiff.toFixed(1)}dB
- 오늘 환경: ${ambientLevel}
- 오늘 기준: ${usedRecal ? '당일 재보정 적용' : '온보딩 기준 사용'}
${hasPattern ? `\n최근 패턴:\n- 성대 부하 추세: ${patternAnalysis.vocalLoadTrend.join(', ')}초` : '(패턴 데이터 부족, 단일 세션 기반으로만 피드백)'}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", 
        max_tokens: 1000,
        system: `당신은 발화 데이터를 분석해서 사용자에게 실용적인 피드백을 주는 코치입니다.

규칙:
1. dB, %, 초 같은 수치를 직접 언급하지 말 것
2. 은유나 시적 표현을 절대 쓰지 말 것
3. 관찰한 사실을 구체적이고 명확하게 말할 것
   좋은 예: '오늘 대화 후반부에 목소리 힘이 많이 들어갔어요.'
   나쁜 예: '목소리가 공간을 채웠어요.' '출렁이고 있어요.'
4. 마지막 문장은 사용자가 스스로 돌아볼 수 있는 간단하고 구체적인 질문으로 끝낼 것
   좋은 예: '오늘 목 상태는 어떤가요?'
   나쁜 예: '요즘 어떤 대화들을 나누고 계신가요?'
5. 2~3문장, 한국어, 간결하게
6. 닉네임이 제공되면 첫 문장에 자연스럽게 포함할 것`,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error("Feedback generation failed:", error);
    return "오늘 발화 데이터를 살펴보는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.";
  }
}
