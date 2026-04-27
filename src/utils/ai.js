
/**
 * AI Quick Add Utility (Enhanced)
 */
export const quickAddTasksWithAI = async (input, language = 'ko') => {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  const isKorean = language && language.startsWith('ko');
  if (!API_KEY || !input) return null;

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
       Example: "내일 아침 7시에 운동하기" -> "운동하기"
    2. "date": Calculate the exact YYYY-MM-DD. If the user says "tomorrow", it must be ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}.
    3. "time": Extract the time in HH:mm format (24h). If no time is mentioned, return null.
    4. "category": Choose one: "home", "work", "personal".
    5. "priority": Choose one: "low", "medium", "high".
    
    Return ONLY a valid JSON object.
  `;

  const safeCall = async (url) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const data = await response.json();
        const resText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const match = resText?.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
      }
      return null;
    } catch (e) { return null; }
  };

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    const listData = await listResponse.json();
    const models = listData.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
    
    // Try the best model first (flash-lite 2.5 or flash 2.0)
    const targetModel = models.find(m => m.name.includes('2.5-flash-lite')) || models.find(m => m.name.includes('flash'));
    
    if (targetModel) {
      const url = `https://generativelanguage.googleapis.com/v1beta/${targetModel.name}:generateContent?key=${API_KEY}`;
      return await safeCall(url);
    }
    return null;
  } catch (err) { return null; }
};

export const analyzeTasksWithAI = async (tasks, language = 'ko') => {
  const userKey = localStorage.getItem('user_gemini_api_key');
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  const API_KEY = (userKey || envKey)?.trim();
  const isKorean = language && language.startsWith('ko');
  
  if (!API_KEY) {
    console.error("DEBUG: API Key missing. userKey exists:", !!userKey, "env exists:", !!import.meta.env.VITE_GEMINI_API_KEY);
    throw new Error(isKorean 
      ? "AI API 키를 찾을 수 없습니다. 설정 메뉴에서 API 키를 직접 입력하거나 환경 변수(.env)를 확인해주세요." 
      : "AI API Key Missing. Please enter your API key in Settings or check environment variables.");
  }

  const prompt = `
    Analyze these tasks for productivity insights: ${JSON.stringify(tasks)}
    Language: ${isKorean ? 'Korean' : 'English'}
    
    Task:
    1. Provide an "efficiencyScore" (0-100) based strictly on: (Completed Tasks / Total Tasks) * 80 + (Priority Weighting) * 20. Ensure consistency across repeated analyses.
    2. Provide a short "insight" about the user's current productivity pattern.
    3. Identify "peakTime" when the user is most active.
    4. Provide a "recommendation" - a practical tip to improve focus.
    5. IMPORTANT: Identify all tasks where "completed" is false. Suggest a specific, prioritized execution order for these remaining tasks. 
    Format: Output ONLY a numbered list where each line is "Number. Task Name (Brief logic/tip)". 
    DO NOT include any introductory or concluding text (e.g., skip "Here is your order..."). Each task MUST be on a new line.
    
    Return ONLY a valid JSON object with: efficiencyScore, insight, peakTime, recommendation, suggestedOrder.
  `;

  try {
    // 사용 가능한 모델 리스트 확인 결과, 가장 최신인 gemini-flash-latest 모델 사용
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API Error Detail:", errorData);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const resText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const match = resText?.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) { 
    console.error("AI Analysis Error:", e);
    return null; 
  }
};
