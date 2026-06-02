import { Chat } from './types';

export const modelOptions = ['Haiku 4.5 Extended', 'Claude 3.5 Sonnet', 'Claude 3.5 Opus'];

export const suggestionPrompts: Record<string, string> = {
  Code: 'Help me write a typescript utility to log and calculate my active workout volume.',
  Learn: 'How should I calculate my daily protein and carbohydrate goals for fat loss?',
  Write: 'Write a 4-day workout program focusing entirely on compound lifts.',
  'Life stuff': 'How do I maintain my gym streak when feeling mentally fatigued and burned out from coding?',
  "Claude's choice": 'Give me a scientific breakdown of squat biomechanics: bar path vs hip flexor torque.',
};

export function createInitialChats(): Chat[] {
  return [
    {
      id: 'chat-1',
      title: 'Comprehensive personal productivity system',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Design a comprehensive personal productivity system for a lifter who also works as a software engineer.' },
        {
          role: 'assistant',
          content:
            'Here is a high-performance productivity system tailored for a high-mental-load job (Software Engineer) and high-physical-demand hobby (Lifting):\n\n### 1. The "Single Source of Truth" Stack\n* **Calendar**: Hard block meetings, deep-work sessions (2h blocks), and workouts (e.g., Mon/Wed/Fri 6:30 PM). Workouts are treated as non-negotiable prod deployments.\n* **Task Manager**: Use a simple backlog + sprints approach. Keep coding backlog and gym progression targets in a markdown folder structure.\n\n### 2. Time-Blocking Protocol\n* **08:00 AM - 10:00 AM**: Deep Code Work (No Slack, no meetings).\n* **10:00 AM - 12:00 PM**: Collaborative syncs and lighter code reviews.\n* **05:30 PM**: Wrap-up and transitional pre-workout meal.\n* **06:30 PM - 08:30 PM**: Lift (High intensity, phone on Do Not Disturb).\n\n### 3. Nutrition Automation\n* **Decision Fatigue Reduction**: Prep lunches on Sunday. Choose 3 primary high-protein dishes and cycle them. Automated grocery deliveries of core staples (eggs, chicken breast, oats, yogurt).',
        },
      ],
    },
    {
      id: 'chat-2',
      title: 'Power outage apology for missed meeting',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Can you write a short professional message apologizing to my team for missing a sprint review due to a sudden power outage?' },
        {
          role: 'assistant',
          content:
            'Here is a professional, polite, and brief message you can share in Slack or via Email:\n\n"Hi everyone,\n\nI apologize for missing the sprint review meeting earlier today. A sudden power outage took out my local internet connection right before we were scheduled to log on, and I was unable to join or send a heads-up in time.\n\nI have reviewed the shared deck and will sync with [Name] directly to catch up on any action items. My apologies again for the disruption!\n\nBest,\nJohn"',
        },
      ],
    },
    {
      id: 'chat-3',
      title: 'File upload time calculation',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'How long would a 2.5 GB dataset take to upload with an upload speed of 12 Mbps?' },
        {
          role: 'assistant',
          content:
            "Let's calculate that file upload duration step-by-step:\n\n1. **Convert Gigabytes (GB) to Gigabits (Gb)**:\n   * 1 byte = 8 bits, so 2.5 GB = 2.5 x 8 = 20 Gigabits (Gb).\n\n2. **Convert to Megabits (Mb)**:\n   * 20 Gb x 1000 = 20,000 Megabits (Mb).\n\n3. **Divide by Upload Speed (12 Mbps)**:\n   * 20,000 Mb / 12 Mb per second ~= 1,666.67 seconds.\n\n4. **Convert to Minutes**:\n   * 1,666.67 seconds / 60 ~= **27.78 minutes** (or about 27 minutes and 47 seconds).\n\n*Note: This is the theoretical minimum. Real-world overhead generally adds 5-15% duration.*",
        },
      ],
    },
    {
      id: 'chat-4',
      title: 'Awoo installation error during software build',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'I am getting a weird error running awoo compile scripts about missing environment targets.' },
        {
          role: 'assistant',
          content:
            "Ah, that typically indicates your target shell environment hasn't exported the critical compiler binaries before running the scripts.\n\nTry running:\n`export AWOO_CORE_PATH=$(pwd)/bin`\nand make sure you compile against the correct libc/musl architecture!",
        },
      ],
    },
    {
      id: 'chat-5',
      title: 'Greeting',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Ayo hello' },
        { role: 'assistant', content: 'Good evening! How can I assist you with your productivity, fitness coding, or workouts tonight?' },
      ],
    },
    {
      id: 'chat-6',
      title: 'Web search context pollution prevention',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'Explain web search context pollution in simple terms.' },
        {
          role: 'assistant',
          content:
            "Web search context pollution happens when irrelevant search results, SEO spam, or dynamic tracking tokens leak into an LLM's active reasoning workspace. When an AI searches the web, retrieving cluttered metadata (headers, cookie banners, navigation crumbs) distracts its narrow context window, reducing accuracy. Preventing this requires using high-quality clean Markdown filters.",
        },
      ],
    },
    {
      id: 'chat-7',
      title: 'Open source models comparable to proprietary ones',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'What are the top open source LLMs right now?' },
        {
          role: 'assistant',
          content:
            'Currently, the most competitive open-weights LLMs are:\n\n1. **Llama 3.1 & 3.2** (Meta): Outstanding general-purpose and tool-use capabilities.\n2. **Gemma 2** (Google): Exceptionally high-quality lightweight models with incredible training efficiency.\n3. **Mistral / Mixtral** (Mistral AI): Pioneers in Mixture-of-Experts architecture.\n4. **DeepSeek-V3**: Extremely cost-efficient, state-of-the-art developer model.',
        },
      ],
    },
    {
      id: 'chat-8',
      title: 'Simple AI logo design',
      date: 'Recent',
      messages: [
        { role: 'user', content: 'What makes a clean AI logo?' },
        {
          role: 'assistant',
          content:
            "A clean AI logo avoids cliched 'glowing brains' or generic blue microchip vectors. Instead, focus on:\n\n1. **Asymmetrical Organic Shapes**: Smooth flower starbursts (like Claude's warm asterisk) or simple geometry.\n2. **High-Contrast Warm Grays**: Humanistic color palettes over cold sci-fi neon.\n3. **Thoughtful Typography Pairing.**",
        },
      ],
    },
  ];
}
