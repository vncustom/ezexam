const API_URL = '/api/gemini';

export interface GenerationConfig {
  prompt: string;
  model?: string;
  systemInstruction?: string;
}

// FALLBACK_MODELS: thứ tự ưu tiên khi model chính gặp lỗi/quota
const FALLBACK_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

export async function callGemini(
  config: GenerationConfig,
  apiKey: string | null = null,
  fallbackIndex = 0
): Promise<any> {
  // Lần đầu dùng model người dùng chọn (config.model), sau đó fallback
  const modelToUse = fallbackIndex === 0
    ? (config.model || FALLBACK_MODELS[0])
    : FALLBACK_MODELS[fallbackIndex];


  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: config.prompt,
        model: modelToUse,
        systemInstruction: config.systemInstruction,
      }),
    });

    if (response.status === 429 && fallbackIndex < FALLBACK_MODELS.length - 1) {
      console.warn(`Model ${modelToUse} rate limited, falling back to ${FALLBACK_MODELS[fallbackIndex + 1]}`);
      return callGemini(config, apiKey, fallbackIndex + 1);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    // Try to parse JSON from text
    let parsedText = data.text;

    if (typeof parsedText === 'string') {
      try {
        // Find JSON block if it's wrapped in markdown
        const jsonMatch = parsedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedText = jsonMatch[1];
        }
        return JSON.parse(parsedText);
      } catch (e) {
        // If not valid JSON, it might throw later, but we'll return the string natively
        console.warn('Response is not valid JSON string, returning raw text.');
        return parsedText;
      }
    }

    return parsedText;

  } catch (error: any) {
    if (fallbackIndex < FALLBACK_MODELS.length - 1) {
      console.warn(`Error with ${modelToUse}: ${error.message}. Falling back to ${FALLBACK_MODELS[fallbackIndex + 1]}`);
      return callGemini(config, apiKey, fallbackIndex + 1);
    }
    throw error;
  }
}
