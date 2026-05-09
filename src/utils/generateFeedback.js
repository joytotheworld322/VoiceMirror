import { isWithinWeeks } from './dateUtils';

export async function generateFeedback({
  nickname,
  userId,
  todayAnalysis,
  patternAnalysis,
  allSessions,
}) {
  // 데이터 양 계산
  const weekSessions  = allSessions.filter(s => isWithinWeeks(s.started_at || s.startedAt, 1));
  const monthSessions = allSessions.filter(s => isWithinWeeks(s.started_at || s.startedAt, 4));

  const weekCount  = weekSessions.length;
  const monthCount = monthSessions.length;

  const depth =
    monthCount >= 20 ? 'long'  :
    weekCount  >= 5  ? 'mid'   :
                       'short';

  // 오늘 분석값
  const voiced   = Math.round((1 - (todayAnalysis.stateRatio?.silent || 0)) * 100);
  const halfDiff = (todayAnalysis.secondHalfAvg || 0) - (todayAnalysis.firstHalfAvg || 0);

  const ambientLevel =
    (todayAnalysis.ambientAnchor || 0) < 40 ? '조용한 환경' :
    (todayAnalysis.ambientAnchor || 0) < 55 ? '보통 환경'   :
    (todayAnalysis.ambientAnchor || 0) < 65 ? '다소 시끄러운 환경' :
                                               '시끄러운 환경';

  // 주간 패턴 요약
  const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
  const hardestDay  = patternAnalysis?.hardestDay;
  const easiestDay  = patternAnalysis?.easiestDay;
  const hardestDayLabel  = hardestDay  != null ? DAY_LABELS[hardestDay]  + '요일' : '없음';
  const easiestDayLabel  = easiestDay  != null ? DAY_LABELS[easiestDay]  + '요일' : '없음';

  const recentLoad  = patternAnalysis?.vocalLoadTrend?.slice(-3) || [];
  const prevLoad    = patternAnalysis?.vocalLoadTrend?.slice(-6, -3) || [];
  const recentMean  = recentLoad.length  > 0 ? recentLoad.reduce((a,b)=>a+b,0)/recentLoad.length   : 0;
  const prevMean    = prevLoad.length    > 0 ? prevLoad.reduce((a,b)=>a+b,0)/prevLoad.length       : 0;
  const trendLabel  =
    recentMean > prevMean * 1.15 ? '성대 부하가 높아지는 추세' :
    recentMean < prevMean * 0.85 ? '성대 부하가 줄어드는 추세' :
                                   '비슷한 수준 유지';

  // 장기 패턴 요약
  const lombardValues   = allSessions.map(s => s.lombard_ratio || s.lombardRatio || 0);
  const lombardTrendLabel =
    lombardValues.length < 5 ? '데이터 부족' :
    lombardValues.slice(-5).reduce((a,b)=>a+b,0)/5 >
    lombardValues.slice(0,5).reduce((a,b)=>a+b,0)/5
      ? '소음 환경에서 목소리가 점점 더 올라가는 경향'
      : '소음 환경 적응이 안정적인 편';

  const allLoadValues   = allSessions.map(s => s.vocal_load_seconds || s.vocalLoadSeconds || 0);
  const longTrendLabel  =
    allLoadValues.length < 10 ? '데이터 부족' :
    allLoadValues.slice(-5).reduce((a,b)=>a+b,0)/5 >
    allLoadValues.slice(0,5).reduce((a,b)=>a+b,0)/5
      ? '장기적으로 성대 부하가 늘고 있는 추세'
      : '장기적으로 성대 부하가 안정되고 있는 추세';


  // System prompt
  const system = `당신은 사용자의 발화 데이터를 장기간 추적해온 발화 코치입니다.

규칙:
1. dB, %, 초 같은 수치를 절대 직접 언급하지 말 것
2. 은유나 시적 표현 금지
   나쁜 예: "목소리가 공간을 채웠어요", "출렁이고 있어요"
3. 관찰 사실을 구체적이고 명확하게 말할 것
   좋은 예: "오늘 대화 후반에 목소리에 힘이 많이 들어갔어요"
4. 의료적 진단 표현 금지
   금지: "성대에 이상이 있습니다", "질환이 의심됩니다"
   허용: "성대에 무리가 가고 있어요", "목을 쉬게 해주는 게 좋을 것 같아요"
5. 마지막 문장은 짧고 구체적인 열린 질문으로 끝낼 것
   좋은 예: "오늘 목 상태는 어떤가요?"
   나쁜 예: "요즘 어떤 대화들을 나누고 계신가요?"
6. 한국어, 2~4문장
7. 닉네임이 있으면 첫 문장에 자연스럽게 포함할 것`;


  // 깊이별 컨텍스트
  const depthContext = {
    short: `분석 범위: 오늘 세션만.
데이터가 막 쌓이기 시작했습니다.
오늘 관찰한 것만 바탕으로 피드백해주세요.
패턴이나 추세를 언급하지 마세요.`,

    mid: `분석 범위: 최근 ${weekCount}개 세션 (약 ${Math.ceil(weekCount/5)}주치).
요일별 패턴과 환경-발화 상관관계를 파악할 수 있는 수준입니다.
반복되는 패턴이 보인다면 구체적으로 언급해주세요.`,

    long: `분석 범위: 최근 ${monthCount}개 세션 (약 ${Math.ceil(monthCount/20)}개월치).
장기 패턴과 개인적 경향을 분석할 수 있습니다.
이 사용자만의 고유한 발화 패턴을 바탕으로 구체적으로 피드백해주세요.`,
  }[depth];


  // User prompt
  const user = `${depthContext}

닉네임: ${nickname || '없음'}

오늘 세션:
- 발화 비율: ${voiced}%
- 성대 무리 구간: ${todayAnalysis.vocalLoadSeconds}초
- 소음 대비 목소리 상승폭: ${(todayAnalysis.lombardRatio || 0).toFixed(1)}
- 목소리 변동성: ${(todayAnalysis.variability || todayAnalysis.vocalVariability || 0).toFixed(1)}
- 세션 후반 볼륨 변화: ${halfDiff > 0 ? '+' : ''}${halfDiff.toFixed(1)}
- 오늘 환경: ${ambientLevel}
${depth !== 'short' ? `
주간 패턴:
- 성대 부하가 높은 요일: ${hardestDayLabel}
- 성대 부하가 낮은 요일: ${easiestDayLabel}
- 최근 추세: ${trendLabel}` : ''}
${depth === 'long' ? `
장기 패턴:
- 장기 성대 부하 추세: ${longTrendLabel}
- 소음-발화 상관 경향: ${lombardTrendLabel}` : ''}`;


  // API 호출
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, userPrompt: user }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return data.content?.[0]?.text || fallbackText;
  } catch (e) {
    console.error('[FEEDBACK] API 실패:', e);
    return fallbackText;
  }
}

const fallbackText =
  '오늘 발화 데이터를 분석하는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.';
