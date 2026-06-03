export interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  parameterSize?: string;
  family?: string;
  quantizationLevel?: string;
}

export interface PullProgress {
  model: string;
  status: string;
  completed?: number;
  total?: number;
  digest?: string;
  done: boolean;
  error?: string;
}

export interface CatalogModel {
  name: string;
  title: string;
  description: string;
  tags: string[];
  sizes: string[];
}

export type OllamaAvailability = 'connecting' | 'ready' | 'no-models' | 'unavailable';
