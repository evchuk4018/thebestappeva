import { Extension } from '@tiptap/core';
import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const docsEditorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  TextStyle,
  FontFamily,
  FontSize,
  Color,
  Highlight.configure({ multicolor: true }),
  Underline,
  Link.configure({ openOnClick: false, defaultProtocol: 'https' }),
  Image.configure({ inline: false }),
  Placeholder.configure({ placeholder: 'Write, type @ for smart chips, or start with a slash command.' }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  HorizontalRule,
  Subscript,
  Superscript,
  CharacterCount,
];
