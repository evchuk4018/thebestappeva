export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  category?: string;
  messages: Message[];
  date: string;
}
