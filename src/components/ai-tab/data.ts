import { CatalogModel } from './types';

export const suggestionPrompts: Record<string, string> = {
  Code: 'Help me write a TypeScript utility to log and calculate my active workout volume.',
  Learn: 'How should I calculate my daily protein and carbohydrate goals for fat loss?',
  Write: 'Write a 4-day workout program focusing entirely on compound lifts.',
  'Life stuff': 'How do I maintain my gym streak when feeling mentally fatigued and burned out from coding?',
  "Model's choice": 'Give me a scientific breakdown of squat biomechanics: bar path vs hip flexor torque.',
};

export const curatedModelCatalog: CatalogModel[] = [
  {
    name: 'qwen3.5:0.8b-q8_0',
    title: 'Qwen 3.5 0.8B',
    description: 'A very small local model for fast experiments and lightweight chats.',
    tags: ['fast', 'small', 'general'],
    sizes: ['0.8B'],
  },
  {
    name: 'qwen3.5:9b',
    title: 'Qwen 3.5 9B',
    description: 'Balanced everyday model for general reasoning, writing, and coding tasks.',
    tags: ['balanced', 'general', 'coding'],
    sizes: ['9B'],
  },
  {
    name: 'gemma3:4b',
    title: 'Gemma 3 4B',
    description: 'Compact general-purpose model with strong quality for local desktop use.',
    tags: ['compact', 'general'],
    sizes: ['4B'],
  },
  {
    name: 'llama3.2:3b',
    title: 'Llama 3.2 3B',
    description: 'Small multilingual assistant model that fits on modest hardware.',
    tags: ['small', 'multilingual'],
    sizes: ['3B'],
  },
  {
    name: 'deepseek-r1:8b',
    title: 'DeepSeek R1 8B',
    description: 'Reasoning-focused model for longer analytical responses.',
    tags: ['reasoning', 'analysis'],
    sizes: ['8B'],
  },
  {
    name: 'qwen2.5-coder:7b',
    title: 'Qwen 2.5 Coder 7B',
    description: 'Code-oriented model suited for programming help and repository questions.',
    tags: ['coding', 'developer'],
    sizes: ['7B'],
  },
  {
    name: 'gpt-oss:20b',
    title: 'gpt-oss 20B',
    description: 'A larger open model for stronger general capability if local hardware can support it.',
    tags: ['large', 'general'],
    sizes: ['20B'],
  },
];
