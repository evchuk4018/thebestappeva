import { Document, Packer, Paragraph } from 'docx';
import mammoth from 'mammoth';
import { DocBundle } from './docs-types';
import { createTimestampLabel, downloadBlob, stripHtml } from './docs-utils';

export async function importDocx(file: File) {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return {
    title: file.name.replace(/\.docx$/i, '') || `Imported ${createTimestampLabel()}`,
    html: result.value,
  };
}

export async function exportDocx(bundle: DocBundle) {
  const paragraphs = bundle.tabs.flatMap((tab) =>
    stripHtml(tab.content)
      .split(/\n+/)
      .flatMap((line) => line.split(/(?<=[.?!])\s+/))
      .filter(Boolean)
      .map((line) => new Paragraph(line)),
  );

  const document = new Document({
    sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph(' ')] }],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, `${bundle.doc.title || 'document'}.docx`);
}

export function exportPdf(bundle: DocBundle) {
  const printWindow = window.open('', '_blank', 'width=1000,height=900');
  if (!printWindow) return;

  const html = bundle.tabs
    .map((tab) => `<section><h2>${tab.title}</h2>${tab.content}</section>`)
    .join('<hr/>');

  printWindow.document.write(`
    <html>
      <head>
        <title>${bundle.doc.title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 48px; color: #111; }
          section { margin-bottom: 40px; }
          img { max-width: 100%; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
