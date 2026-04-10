const { GoogleGenAI } = require('@google/genai');

let _client = null;
function getClient() {
  if (!_client) _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _client;
}

// Convert Anthropic-style history to Gemini contents format
// Anthropic: [{ role: 'user'|'assistant', content: string }]
// Gemini:    [{ role: 'user'|'model',     parts: [{ text }] }]
function toGeminiContents(messages) {
  return messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

// Extract text from Gemini response, skipping thinking parts
function extractText(response) {
  // Try the convenience getter first
  const quick = response.text;
  if (typeof quick === 'string' && quick.length > 0) return quick;

  // Fall back: walk candidates manually, skip thought parts
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter(p => typeof p.text === 'string' && !p.thought)
    .map(p => p.text)
    .join('');

  if (text.length > 0) return text;

  // Last resort: any text at all (including thought)
  const anyText = parts.filter(p => typeof p.text === 'string').map(p => p.text).join('');
  if (anyText.length > 0) return anyText;

  throw new Error(`Gemini returned no text. Finish reason: ${response?.candidates?.[0]?.finishReason}`);
}

// Call Gemini API with same interface as Anthropic routes
// history includes the final user message at the end
async function callGemini({ model, systemInstruction, history, maxTokens = 8192 }) {
  const response = await getClient().models.generateContent({
    model,
    contents: toGeminiContents(history),
    config: {
      systemInstruction,
      maxOutputTokens: maxTokens,
    },
  });

  return extractText(response);
}

module.exports = { callGemini };
