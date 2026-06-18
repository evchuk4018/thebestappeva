import type { AiVisionMetadata, AiVisionProvider } from '../../shared/ai-vision-contract';

export interface VisionProviderHealth {
  available: boolean;
  provider: AiVisionProvider;
  detail: string;
}

export interface VisionProviderResult {
  provider: AiVisionProvider;
  model: string;
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface VisionRequestOptions {
  mediaType?: string;
}

export interface VisionProvider {
  provider: AiVisionProvider;
  healthCheck(): Promise<VisionProviderHealth>;
  describeImage(imageBase64: string, options?: VisionRequestOptions): Promise<VisionProviderResult>;
  answerImageQuestion(imageBase64: string, question: string, options?: VisionRequestOptions): Promise<VisionProviderResult>;
}

export interface ResolvedVisionResult {
  text: string;
  metadata: AiVisionMetadata;
}
