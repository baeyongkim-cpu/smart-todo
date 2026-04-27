/**
 * AI Quick Add Utility (Enhanced)
 */
const callAIProxy = async (contents, model = 'gemini-flash-latest') => {
  const localKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  
  // 로컬 개발 환경에서 키가 있으면 직접 호출 (편의성)
  // 배포 환경(Vercel)에서는 키가 없으므로 /api/ai 프록시 호출 (보안)
  if (localKey && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${localKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      });
      if (response.ok) {
        const data = await response.json();
        const resText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const match = resText?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
      }
    } catch (e) {
      console.warn("Local direct AI call failed, falling back to proxy...");
    }
  }

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, model })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const resText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const match = resText?.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (err) {
    console.error("AI Proxy Error:", err);
    throw err;
  }
};

export const quickAddTasksWithAI = async (input, language = 'ko') => {
  if (!input) return null;
  const isKorean = language && language.startsWith('ko');
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][today.getDay()];

  const prompt = `
    Context:
    - Today's Date: ${todayStr} (${dayOfWeek})
    - User Language: ${isKorean ? 'Korean' : 'English'}
    
    Task: Extract the core intent from the sentence: "${input}"
    
    Rules:
    1. "text": Extract ONLY the core task description. REMOVE all time/date keywords (e.g., "내일", "오전 7시", "tomorrow", "at 3pm").
    2. "date": Calculate the exact YYYY-MM-DD.
    3. "time": Extract the time in HH:mm format (24h). If no time is mentioned, return null.
    4. "category": Choose one: "home", "work", "personal".
    5. "priority": Choose one: "low", "medium", "high".
    
    Return ONLY a valid JSON object.
  `;

  try {
    return await callAIProxy([{ parts: [{ text: prompt }] }]);
  } catch (e) { return null; }
};

export const analyzeTasksWithAI = async (tasks, language = 'ko') => {
  const isKorean = language && language.startsWith('ko');
  const prompt = `
    Analyze these tasks for productivity insights: ${JSON.stringify(tasks)}
    Language: ${isKorean ? 'Korean' : 'English'}
    
    Task:
    1. Provide an "efficiencyScore" (0-100)
    2. Provide a short "insight"
    3. Identify "peakTime"
    4. Provide a "recommendation"
    5. Suggest a "suggestedOrder" (numbered list)
    
    Return ONLY a valid JSON object with: efficiencyScore, insight, peakTime, recommendation, suggestedOrder.
  `;

  try {
    return await callAIProxy([{ parts: [{ text: prompt }] }]);
  } catch (e) {
    console.error("AI Analysis Error:", e);
    throw e;
  }
};
