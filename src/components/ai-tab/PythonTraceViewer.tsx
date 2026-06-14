import type { ReactNode } from 'react';
import { PythonTraceInspection } from './python-trace';

interface PythonTraceViewerProps {
  inspection: PythonTraceInspection;
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-xl border border-[#2a2a27] bg-[#10100f] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function PythonTraceViewer({ inspection }: PythonTraceViewerProps) {
  return (
    <details className="mt-3 rounded-xl border border-[#2a2a27] bg-[#11110f]">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-[#d9e7f3]">View Python</summary>
      <div className="space-y-3 border-t border-[#2a2a27] px-3 py-3">
        <Section title="Execution">
          <p className="text-xs leading-relaxed text-zinc-300">
            Exit code: {inspection.exitCode ?? 'pending'} {' • '} Duration: {inspection.durationMs ?? 'pending'}ms
          </p>
        </Section>

        <Section title="Requested Files">
          <p className="text-xs leading-relaxed text-zinc-300">
            {inspection.requestedFiles.length ? inspection.requestedFiles.join(', ') : 'No repo files were staged.'}
          </p>
        </Section>

        <Section title="Staged Files">
          <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">
            {inspection.stagedFiles.length
              ? inspection.stagedFiles.map((file) => `${file.requestedPath} -> ${file.sandboxPath}`).join('\n')
              : 'No staged file metadata recorded yet.'}
          </p>
        </Section>

        <Section title="Code">
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">{inspection.code || 'No code captured.'}</pre>
        </Section>

        <Section title="Stdout">
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">{inspection.stdout || 'No stdout.'}</pre>
        </Section>

        <Section title="Stderr">
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-200">{inspection.stderr || 'No stderr.'}</pre>
        </Section>

        <Section title="Generated Files">
          <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">
            {inspection.generatedFiles.length
              ? inspection.generatedFiles.map((file) => `${file.path} (${file.sizeBytes} bytes)`).join('\n')
              : 'No generated files.'}
          </p>
        </Section>
      </div>
    </details>
  );
}
