import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

interface AssistantMessageContentProps {
  content: string;
}

const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => <a {...props} rel="noreferrer noopener" target="_blank" />,
  table: ({ node: _node, ...props }) => (
    <div className="ai-markdown-table">
      <table {...props} />
    </div>
  ),
};

export function AssistantMessageContent({ content }: AssistantMessageContentProps) {
  return (
    <div className="ai-markdown">
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
