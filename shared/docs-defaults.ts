import type { DocPageSettings, DocPreferences, DocTemplate } from './docs-contract';

export const defaultPageSettings: DocPageSettings = {
  paperSize: 'Letter',
  orientation: 'portrait',
  pageColor: '#0b0c0f',
  margins: { top: 72, right: 72, bottom: 72, left: 72 },
};

export const defaultDocPreferences: DocPreferences = {
  sort: 'lastOpenedAt',
  showTemplates: true,
};

export const docTemplates: DocTemplate[] = [
  {
    id: 'blank',
    name: 'Blank document',
    description: 'Start with an empty page.',
    category: 'General',
    title: 'Untitled document',
    tabs: [{ title: 'Tab 1', parentTabId: null, html: '<h1>Lorem Ipsum Example Document</h1><h2>What is Lorem Ipsum?</h2><p>Start writing here.</p>' }],
  },
  {
    id: 'resume',
    name: 'Resume',
    description: 'Modern single-page resume.',
    category: 'Career',
    title: 'Resume Draft',
    tabs: [{ title: 'Profile', parentTabId: null, html: '<h1>Your Name</h1><p>City, State - email@example.com - (555) 555-5555</p><h2>Experience</h2><p>Describe your impact.</p><h2>Education</h2><p>Add your background.</p>' }],
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Agenda, notes, and action items.',
    category: 'Meetings',
    title: 'Weekly Meeting Notes',
    tabs: [{ title: 'Agenda', parentTabId: null, html: '<h1>Weekly Meeting Notes</h1><p><strong>Date:</strong> @today</p><h2>Agenda</h2><ul><li>Project updates</li><li>Risks</li><li>Next steps</li></ul><h2>Notes</h2><p></p>' }],
  },
  {
    id: 'project-roadmap',
    name: 'Project roadmap',
    description: 'Goals, milestones, and risks.',
    category: 'Project',
    title: 'Project Roadmap',
    tabs: [{ title: 'Overview', parentTabId: null, html: '<h1>Project Roadmap</h1><h2>Goals</h2><ul><li>Define success</li></ul><h2>Milestones</h2><ol><li>Kickoff</li><li>Launch</li></ol>' }],
  },
  {
    id: 'email-draft',
    name: 'Email draft',
    description: 'Write a polished outbound email.',
    category: 'Communication',
    title: 'Email Draft',
    tabs: [{ title: 'Draft', parentTabId: null, html: '<h1>Email Draft</h1><p><strong>To:</strong> @person</p><p><strong>Subject:</strong> Project update</p><p>Hello team,</p><p>Here is the latest update.</p><p>Best,<br/>Your Name</p>' }],
  },
];
