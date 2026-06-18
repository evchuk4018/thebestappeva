import { HttpError } from '../http';
import { answerLocalImageQuestion, describeLocalImage, ensureVisionModelReady } from './vision-model';
import type { VisionProvider } from './vision-provider-types';

export function createLocalVisionProvider(): VisionProvider {
  return {
    provider: 'local',
    async healthCheck() {
      try {
        const model = await ensureVisionModelReady();
        return {
          available: true,
          provider: 'local',
          detail: `Local vision model "${model}" is ready.`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Local vision is unavailable.';
        return {
          available: false,
          provider: 'local',
          detail: message,
        };
      }
    },
    async describeImage(imageBase64, options) {
      const response = await describeLocalImage(imageBase64, options);
      return {
        provider: 'local',
        model: response.model,
        text: response.summary,
      };
    },
    async answerImageQuestion(imageBase64, question, options) {
      if (!question.trim()) {
        throw new HttpError(400, 'Image questions require a non-empty question.');
      }
      const response = await answerLocalImageQuestion(imageBase64, question, options);
      return {
        provider: 'local',
        model: response.model,
        text: response.answer,
      };
    },
  };
}
