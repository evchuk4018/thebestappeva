import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { chatWithModel, listModels } from '../../lib/ollama/runtime';
import { loadStoredSelectedModel } from '../../lib/ollama/model-storage';
import { buildDocsRewritePrompt } from './docs-rewrite-prompt';

type RewriteStatus = 'idle' | 'loading' | 'preview' | 'error';

interface SelectionSnapshot {
  from: number;
  to: number;
  text: string;
}

interface PendingRewrite {
  from: number;
  to: number;
  originalText: string;
}

const PREVIEW_COLOR = '#a855f7';
const INTERNAL_META_KEY = 'docs-rewrite-internal';

function readSelectionSnapshot(editor: Editor) {
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    return null;
  }

  const text = editor.state.doc.textBetween(from, to, '\n');
  return text.trim() ? { from, to, text } satisfies SelectionSnapshot : null;
}

function setHighlightedPreview(editor: Editor, from: number, to: number, text: string) {
  const { state, view } = editor;
  const highlight = state.schema.marks.highlight;
  let tr = state.tr.insertText(text, from, to);
  tr = tr.setSelection(TextSelection.create(tr.doc, from, from + text.length));
  if (highlight) {
    tr = tr.addMark(from, from + text.length, highlight.create({ color: PREVIEW_COLOR }));
  }
  tr.setMeta(INTERNAL_META_KEY, true);
  view.dispatch(tr);
  editor.commands.focus();
  return { from, to: from + text.length };
}

function clearHighlightedPreview(editor: Editor, from: number, to: number) {
  const { state, view } = editor;
  const highlight = state.schema.marks.highlight;
  let tr = state.tr.setSelection(TextSelection.create(state.doc, from, to));
  if (highlight) {
    tr = tr.removeMark(from, to, highlight);
  }
  tr.setMeta(INTERNAL_META_KEY, true);
  view.dispatch(tr);
  editor.commands.focus();
}

function restoreOriginalSelection(editor: Editor, pending: PendingRewrite) {
  const { state, view } = editor;
  const highlight = state.schema.marks.highlight;
  let tr = state.tr.insertText(pending.originalText, pending.from, pending.to);
  const nextTo = pending.from + pending.originalText.length;
  tr = tr.setSelection(TextSelection.create(tr.doc, pending.from, nextTo));
  if (highlight) {
    tr = tr.removeMark(pending.from, nextTo, highlight);
  }
  tr.setMeta(INTERNAL_META_KEY, true);
  view.dispatch(tr);
  editor.commands.focus();
  return { from: pending.from, to: nextTo, text: pending.originalText } satisfies SelectionSnapshot;
}

async function resolveRewriteModel() {
  const models = await listModels();
  if (!models.length) {
    throw new Error('No local Ollama models are installed.');
  }

  const preferred = await loadStoredSelectedModel();
  return models.find((model) => model.name === preferred)?.name ?? models[0].name;
}

export function useDocsRewrite(editor: Editor | null) {
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [status, setStatus] = useState<RewriteStatus>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingRewriteRef = useRef<PendingRewrite | null>(null);
  const selectionRef = useRef<SelectionSnapshot | null>(null);

  function syncPendingRewrite(nextPending: PendingRewrite | null) {
    pendingRewriteRef.current = nextPending;
    setStatus(nextPending ? 'preview' : 'idle');
  }

  const rejectPreview = useEffectEvent((keepBarOpen = true) => {
    if (!editor || !pendingRewriteRef.current) {
      if (!keepBarOpen) {
        setIsOpen(false);
        setPrompt('');
        setSelectedText('');
        setError(null);
        setStatus('idle');
      }
      return;
    }

    selectionRef.current = restoreOriginalSelection(editor, pendingRewriteRef.current);
    setSelectedText(selectionRef.current.text);
    setError(null);
    syncPendingRewrite(null);
    if (!keepBarOpen) {
      setIsOpen(false);
      setPrompt('');
      setSelectedText('');
    }
  });

  const closeBar = useEffectEvent(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    rejectPreview(false);
  });

  const openBarFromSelection = useEffectEvent((selection: SelectionSnapshot) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (pendingRewriteRef.current) {
      rejectPreview(true);
    }

    selectionRef.current = selection;
    setError(null);
    setIsOpen(true);
    setPrompt('');
    setSelectedText(selection.text);
    setStatus('idle');
  });

  const generateRewrite = useEffectEvent(async (nextPrompt = prompt) => {
    if (!editor) {
      return;
    }

    const baseSelection = pendingRewriteRef.current
      ? { from: pendingRewriteRef.current.from, to: pendingRewriteRef.current.to, text: pendingRewriteRef.current.originalText }
      : selectionRef.current;
    if (!baseSelection) {
      setError('Select text first, then press / to rewrite it.');
      setStatus('error');
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPrompt(nextPrompt);
    setError(null);
    setStatus('loading');

    try {
      const model = await resolveRewriteModel();
      const reply = await chatWithModel(model, buildDocsRewritePrompt(baseSelection.text, nextPrompt), {
        signal: controller.signal,
        think: false,
      });
      const rewrittenText = reply.content.trim();
      if (!rewrittenText) {
        throw new Error('Ollama returned an empty rewrite.');
      }

      const previewRange = setHighlightedPreview(editor, baseSelection.from, baseSelection.to, rewrittenText);
      selectionRef.current = { from: previewRange.from, to: previewRange.to, text: baseSelection.text };
      setSelectedText(baseSelection.text);
      setError(null);
      syncPendingRewrite({
        from: previewRange.from,
        to: previewRange.to,
        originalText: baseSelection.text,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        setStatus(pendingRewriteRef.current ? 'preview' : 'idle');
        return;
      }

      setError(cause instanceof Error ? cause.message : 'The local rewrite request failed.');
      setStatus(pendingRewriteRef.current ? 'preview' : 'error');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  });

  const approvePreview = useEffectEvent(() => {
    if (!editor || !pendingRewriteRef.current) {
      return;
    }

    clearHighlightedPreview(editor, pendingRewriteRef.current.from, pendingRewriteRef.current.to);
    selectionRef.current = null;
    setSelectedText('');
    setError(null);
    setIsOpen(false);
    setPrompt('');
    syncPendingRewrite(null);
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.defaultPrevented) {
        return;
      }

      const selection = readSelectionSnapshot(editor);
      if (!selection) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openBarFromSelection(selection);
    };

    const dom = editor.view.dom;
    dom.addEventListener('keydown', handleKeydown, true);
    return () => dom.removeEventListener('keydown', handleKeydown, true);
  }, [editor, openBarFromSelection]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleTransaction = ({ transaction }: { transaction: { docChanged: boolean; getMeta: (key: string) => unknown; mapping: { map: (position: number, assoc?: number) => number } } }) => {
      const currentPending = pendingRewriteRef.current;
      if (!transaction.docChanged || !currentPending || transaction.getMeta(INTERNAL_META_KEY)) {
        return;
      }

      pendingRewriteRef.current = {
        ...currentPending,
        from: transaction.mapping.map(currentPending.from, -1),
        to: transaction.mapping.map(currentPending.to, 1),
      };
    };

    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor]);

  useEffect(() => {
    const rejectOnUnload = () => rejectPreview(true);
    window.addEventListener('beforeunload', rejectOnUnload);
    return () => window.removeEventListener('beforeunload', rejectOnUnload);
  }, [rejectPreview]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  return {
    approvePreview,
    closeBar,
    error,
    generateRewrite,
    hasPendingPreview: Boolean(pendingRewriteRef.current),
    isOpen,
    prompt,
    rejectPreview,
    selectedText,
    setPrompt,
    status,
  };
}
