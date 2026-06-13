import type { Request, Response } from 'express';
import { createAiMemoryService } from './ai-memory-service';

export async function handlePostAiMemoryRefresh(request: Request, response: Response) {
  const chatId = typeof request.params.chatId === 'string' ? request.params.chatId.trim() : '';
  const payload = await createAiMemoryService().refreshChatMemory(chatId);
  response.status(200).json(payload);
}
