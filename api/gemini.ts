import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // CORS headers (needed if calling from browser)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  try {
    const { prompt, model, systemInstruction } = req.body;
    const clientApiKey = req.headers['x-api-key'] as string;

    // Priority: user-supplied key from header → server env variable
    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: "Thiếu Gemini API Key. Vui lòng nhập key trong phần Cài đặt hoặc cấu hình biến môi trường GEMINI_API_KEY trên Vercel."
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: model || "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Return specific status codes for common errors
    if (error.status === 429) {
      return res.status(429).json({ error: "Rate limit exceeded. Vui lòng thử lại sau." });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: "API Key không hợp lệ hoặc yêu cầu bị từ chối." });
    }
    return res.status(500).json({ error: error.message || "Lỗi không xác định khi gọi Gemini API." });
  }
}
