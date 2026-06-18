import type { PythonExecGeneratedFile } from './tools/python-exec-contract';

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => parseCsvLine(line));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function DataTable({ rows }: { rows: string[][] }) {
  if (!rows.length) {
    return null;
  }
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto rounded-lg border border-[#232320] bg-[#11110f]">
      <table className="min-w-full text-xs text-zinc-200">
        <thead className="bg-[#171715] text-[10px] uppercase tracking-wider text-zinc-400">
          <tr>
            {header.map((cell, index) => (
              <th key={index} className="px-2 py-1 text-left">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[#232320]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-1 align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeneratedImage({ file }: { file: PythonExecGeneratedFile }) {
  const src = file.downloadUrl ?? '';
  if (!src) {
    return null;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block">
      <img
        src={src}
        alt={file.path}
        className="max-h-72 w-auto rounded-lg border border-[#232320]"
      />
      <span className="mt-1 block text-[11px] text-zinc-500">{file.path}</span>
    </a>
  );
}

function GeneratedFileCard({ file }: { file: PythonExecGeneratedFile }) {
  if (file.kind === 'image') {
    return <GeneratedImage file={file} />;
  }
  if (file.kind === 'text' && file.mediaType === 'text/csv' && file.preview) {
    return (
      <div className="space-y-1">
        <DataTable rows={parseCsv(file.preview)} />
        <FileDownloadRow file={file} />
      </div>
    );
  }
  return <FileDownloadRow file={file} />;
}

function FileDownloadRow({ file }: { file: PythonExecGeneratedFile }) {
  const href = file.downloadUrl ?? '';
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[#232320] bg-[#11110f] px-2 py-1.5">
      <span className="truncate font-mono text-[11px] text-zinc-300">{file.path}</span>
      <span className="text-[10px] text-zinc-500">{file.sizeBytes} bytes</span>
      {href ? (
        <a
          href={href}
          download={file.path.split('/').pop()}
          className="rounded border border-[#2a3d54] bg-[#16202a] px-2 py-0.5 text-[10px] text-[#8db4d0] hover:bg-[#1f2e3a]"
        >
          Download
        </a>
      ) : null}
    </div>
  );
}

export function PythonGeneratedFiles({ files }: { files: PythonExecGeneratedFile[] }) {
  if (!files.length) {
    return <p className="text-xs leading-relaxed text-zinc-300">No generated files.</p>;
  }
  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div key={file.path} className="space-y-1">
          <GeneratedFileCard file={file} />
        </div>
      ))}
    </div>
  );
}