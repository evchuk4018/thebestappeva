import { listTaskCategories } from '../task-manager/data';
import { NoteRecord } from './notes-types';
import { createNoteId, toPlainText } from './notes-utils';

function hoursAgo(amount: number) {
  return new Date(Date.now() - amount * 60 * 60 * 1000).toISOString();
}

function pickCategory(categories: string[], preferred: string) {
  return categories.includes(preferred) ? preferred : categories[0] ?? '';
}

export function createSeedNotes() {
  const categories = listTaskCategories();
  const drafts = [
    {
      title: 'Voiceover hook ideas',
      body: 'Open with the result, not the process.\nMention the 30-second promise before the first cut.',
      category: pickCategory(categories, 'Content'),
      tags: ['youtube', 'hooks'],
      pinned: true,
      updatedAt: hoursAgo(1),
    },
    {
      title: '',
      body: 'Need a cleaner way to separate “today” tasks from deep work planning. Maybe pin one note per focus area.',
      category: '',
      tags: ['product', 'ux'],
      pinned: false,
      updatedAt: hoursAgo(4),
    },
    {
      title: 'Weekend plan',
      body: 'Saturday lift at noon.\nDinner shortlist: Llama Inn, Rule of Thirds.\nCheck reservations by Thursday.',
      category: pickCategory(categories, 'Personal'),
      tags: ['weekend'],
      pinned: false,
      updatedAt: hoursAgo(9),
    },
    {
      title: 'Sprint cleanup checklist',
      body: 'Archive stale tickets.\nRe-tag blockers.\nPull one screenshot of the current board before changes.',
      category: pickCategory(categories, 'Operations'),
      tags: ['ops', 'planning'],
      pinned: true,
      updatedAt: hoursAgo(15),
    },
    {
      title: 'Errands to batch',
      body: 'Return tripod plate.\nPick up electrolytes.\nCall dentist after lunch tomorrow.',
      category: '',
      tags: ['admin'],
      pinned: false,
      updatedAt: hoursAgo(29),
    },
  ];

  return drafts.map((draft) => ({
    id: createNoteId('note'),
    title: draft.title || draft.body.split('\n')[0],
    body: draft.body,
    plainTextBody: toPlainText(draft.body),
    category: draft.category,
    tags: draft.tags,
    pinned: draft.pinned,
    createdAt: draft.updatedAt,
    updatedAt: draft.updatedAt,
  })) satisfies NoteRecord[];
}
