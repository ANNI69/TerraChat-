/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || '';

export async function generateChatResponse(prompt: string, history: { role: 'user' | 'model', content: string }[]) {
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-3.1-pro-preview";

  const contents = history.map(h => ({
    role: h.role,
    parts: [{ text: h.content }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction: "You are Terra, a grounded, organic AI assistant. Your goal is to provide warm, thoughtful, and helpful responses. You prioritize human connection and natural wisdom. When users ask complex queries, use your thinking mode to provide deep, well-reasoned answers.",
      },
    });

    return {
      text: response.text || '',
      thinking: response.candidates?.[0]?.content?.parts?.find(p => p.thought)?.thought || ''
    };
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}
