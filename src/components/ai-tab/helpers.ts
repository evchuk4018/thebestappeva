import { Chat, Message } from './types';
import { suggestionPrompts } from './data';

export function createChatTitle(message: string) {
  const summary = message.split(' ').slice(0, 4).join(' ');
  return summary.length > 30 ? `${summary.slice(0, 30)}...` : summary || 'New workout discussion';
}

export function createNewChat(message: string): Chat {
  return {
    id: `chat-${Date.now()}`,
    title: createChatTitle(message),
    date: 'Just now',
    messages: [{ role: 'user', content: message }],
  };
}

export function getSuggestionPrompt(label: string) {
  return suggestionPrompts[label] ?? '';
}

export function appendMessage(chat: Chat, message: Message) {
  return { ...chat, messages: [...chat.messages, message] };
}

export function buildAiResponse(messageText: string) {
  const text = messageText.toLowerCase();

  if (text.includes('code') || text.includes('typescript') || text.includes('utility')) {
    return 'Here is a custom TypeScript utility function for LiftLog to calculate target training volume:\n\n```typescript\ninterface WorkoutSet {\n  kg: number;\n  reps: number;\n}\n\nexport function calculateTrainingVolume(sets: WorkoutSet[]): number {\n  return sets.reduce((total, set) => total + (set.kg * set.reps), 0);\n}\n\nconst volumeSq = calculateTrainingVolume([\n  { kg: 100, reps: 5 },\n  { kg: 100, reps: 5 },\n  { kg: 102, reps: 4 }\n]);\nconsole.log(`Squat volume: ${volumeSq} kg`);\n```\n\nThis simple utility acts as a strong baseline for tracking workouts in the frontend. Want a version broken down by exercise?';
  }

  if (text.includes('squat') || text.includes('form') || text.includes('knees')) {
    return `Let's break down squat form mechanics.\n\n1. **Bracing**: Take a big breath and brace your core outward.\n2. **Hip hinge**: Break at the hips slightly first, then let the knees track with the toes.\n3. **Foot pressure**: Keep pressure through big toe, pinky toe, and heel.\n\nAvoid knee valgus. If the knees cave in, lower the load and drill band-resisted walks.`;
  }

  if (text.includes('protein') || text.includes('diet') || text.includes('macros') || text.includes('fat loss')) {
    return 'For fat loss while preserving muscle:\n\n1. **Protein**: 1.8g to 2.2g per kg of body weight.\n2. **Fats**: Roughly 20-30% of total calories.\n3. **Carbs**: Fill the remaining calories with carbs that support training.\n\nA modest 300-500 kcal deficit is usually easier to sustain than an aggressive cut.';
  }

  if (text.includes('program') || text.includes('workout') || text.includes('split')) {
    return 'Here is a solid 4-day compound-focused split:\n\n* **Day 1: Upper push**: Bench, overhead press, incline dumbbell flyes, triceps.\n* **Day 2: Lower squat**: Squat, Romanian deadlift, leg press, calves.\n* **Day 3: Rest or mobility**\n* **Day 4: Upper pull**: Deadlift, pulldown or pull-ups, chest-supported rows, curls.\n* **Day 5: Lower accessory**: Hack squat, leg curl, leg extension, abs.\n\nTrack load and reps each week so progressive overload is obvious.';
  }

  if (text.includes('streak') || text.includes('burnout') || text.includes('fatigue')) {
    return 'Use the 10-minute gym rule: commit only to getting there and lifting lightly for 10 minutes. Most of the time momentum carries the rest of the session. On the bad days, you still preserve the habit without grinding yourself down.';
  }

  return "Thanks for asking that. Under the hood, I'm mapping your question back to LiftLog's training and habit loops. Ask about squat form, nutrition tracking, recovery, or programming and I can make the answer more specific.";
}
