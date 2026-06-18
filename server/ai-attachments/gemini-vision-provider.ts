import { serverConfig } from '../config';
import { fetchWithTimeout, HttpError } from '../http';
import type { VisionProvider, VisionProviderResult, VisionRequestOptions } from './vision-provider-types';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const priceTable: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'gemini-2.5-flash-lite': { inputPerMillion: 0.25, outputPerMillion: 1.5 },
  'gemini-2.5-flash': { inputPerMillion: 1.5, outputPerMillion: 9 },
};

function isDetailedQuestion(question: string) {
  return /(ocr|small text|tiny text|read the text|transcribe|diagram|chart|graph|table|document|layout|spatial|bounding box|coordinate|position|where|ui|interface|screenshot|follow-up|compare|exact|precise|relationship)/i.test(question);
}

function estimateCostUsd(model: string, promptTokens?: number, outputTokens?: number) {
  const pricing = priceTable[model];
  if (!pricing) {
    return undefined;
  }
  const inputCost = ((promptTokens ?? 0) / 1_000_000) * pricing.inputPerMillion;
  const outputCost = ((outputTokens ?? 0) / 1_000_000) * pricing.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(8));
}

function buildPrompt(question?: string) {
  if (!question) {
    return [
      'Describe this image for a text-only assistant.',
      'Return a concise 2-3 sentence summary covering the main subject, any visible text, and the overall layout.',
      'Do not speculate beyond what is visible.',
    ].join(' ');
  }
  return [
    'Answer the user question about this image directly and concisely.',
    'Call out uncertainty when the image does not support a confident answer.',
    `Question: ${question.trim()}`,
  ].join('\n');
}

function readGeminiText(payload: GeminiGenerateContentResponse) {
  const blockReason = payload.promptFeedback?.blockReason?.trim();
  if (blockReason) {
    throw new HttpError(502, `Gemini blocked the vision request: ${blockReason}.`);
  }
  const text = payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text?.trim() ?? '').find(Boolean);
  if (!text) {
    const finishReason = payload.candidates?.[0]?.finishReason?.trim();
    throw new HttpError(502, finishReason ? `Gemini returned no usable image response (${finishReason}).` : 'Gemini returned no usable image response.');
  }
  return text;
}

async function readGeminiJson(response: Response) {
  const payload = await response.json().catch(() => null) as GeminiGenerateContentResponse | null;
  if (!response.ok) {
    const message = payload?.error?.message?.trim() || `Gemini vision request failed with ${response.status}.`;
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }
  if (!payload) {
    throw new HttpError(502, 'Gemini returned invalid JSON.');
  }
  return payload;
}

async function requestGemini(model: string, imageBase64: string, prompt: string, options: VisionRequestOptions = {}): Promise<VisionProviderResult> {
  const mediaType = options.mediaType?.trim() || 'image/png';
  const response = await fetchWithTimeout(
    `${serverConfig.geminiBaseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': serverConfig.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mediaType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          maxOutputTokens: serverConfig.visionMaxOutputTokens,
        },
      }),
    },
    serverConfig.visionTimeoutMs,
  );
  const payload = await readGeminiJson(response);
  const promptTokens = payload.usageMetadata?.promptTokenCount;
  const outputTokens = payload.usageMetadata?.candidatesTokenCount;
  const totalTokens = payload.usageMetadata?.totalTokenCount;
  return {
    provider: 'gemini',
    model,
    text: readGeminiText(payload),
    inputTokens: promptTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd(model, promptTokens, outputTokens),
  };
}

export function createGeminiVisionProvider(): VisionProvider {
  return {
    provider: 'gemini',
    async healthCheck() {
      return serverConfig.geminiApiKey
        ? { available: true, provider: 'gemini', detail: `Gemini vision is configured for ${serverConfig.onlineSummaryModel}.` }
        : { available: false, provider: 'gemini', detail: 'Gemini vision is unavailable because GEMINI_API_KEY is not set.' };
    },
    async describeImage(imageBase64, options) {
      if (!serverConfig.geminiApiKey) {
        throw new HttpError(503, 'Gemini vision is unavailable because GEMINI_API_KEY is not set.');
      }
      return requestGemini(serverConfig.onlineSummaryModel, imageBase64, buildPrompt(), options);
    },
    async answerImageQuestion(imageBase64, question, options) {
      if (!serverConfig.geminiApiKey) {
        throw new HttpError(503, 'Gemini vision is unavailable because GEMINI_API_KEY is not set.');
      }
      const model = isDetailedQuestion(question) ? serverConfig.onlineDetailedModel : serverConfig.onlineSummaryModel;
      return requestGemini(model, imageBase64, buildPrompt(question), options);
    },
  };
}
