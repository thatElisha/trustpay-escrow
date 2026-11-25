'use client';

import React, { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownDeliverableEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

type EditorTab = 'write' | 'preview';
type FormatAction = 'bold' | 'list' | 'code';

export function MarkdownDeliverableEditor({
  value,
  onChange,
  placeholder = 'Describe the work completed, decisions made, and how to verify the deliverables...',
  rows = 10,
}: MarkdownDeliverableEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('write');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = (action: FormatAction) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);

    let replacement = '';
    let selectionStart = start;
    let selectionEnd = start;

    if (action === 'bold') {
      const content = selected || 'bold text';
      replacement = `**${content}**`;
      selectionStart = start + 2;
      selectionEnd = selectionStart + content.length;
    } else if (action === 'list') {
      const content = selected || 'List item';
      replacement = content
        .split('\n')
        .map((line) => `- ${line.replace(/^[-*]\s*/, '')}`)
        .join('\n');
      selectionStart = start;
      selectionEnd = start + replacement.length;
    } else {
      const content = selected || 'const result = await verify();';
      replacement = `\n\`\`\`\n${content}\n\`\`\`\n`;
      selectionStart = start + replacement.indexOf(content);
      selectionEnd = selectionStart + content.length;
    }

    onChange(value.slice(0, start) + replacement + value.slice(end));
    setActiveTab('write');

    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(selectionStart, selectionEnd);
    }, 0);
  };

  return (
    <div className="rounded-xl border border-[#333338] bg-[#141417] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272a] bg-[#1c1c20] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="markdown-bold"
            title="Bold"
            aria-label="Bold"
            onClick={() => applyFormat('bold')}
            className="w-7 h-7 rounded-md font-bold text-sm text-[#d4d4d8] hover:bg-[#2a2a30] hover:text-white transition-colors"
          >
            B
          </button>
          <button
            type="button"
            data-testid="markdown-list"
            title="Bullet list"
            aria-label="Bullet list"
            onClick={() => applyFormat('list')}
            className="w-7 h-7 rounded-md text-sm font-bold text-[#d4d4d8] hover:bg-[#2a2a30] hover:text-white transition-colors"
          >
            ≡
          </button>
          <button
            type="button"
            data-testid="markdown-code"
            title="Code block"
            aria-label="Code block"
            onClick={() => applyFormat('code')}
            className="h-7 px-2 rounded-md font-mono text-xs text-[#d4d4d8] hover:bg-[#2a2a30] hover:text-white transition-colors"
          >
            {'</>'}
          </button>
          <span className="ml-1 text-[10px] text-[#71717a] hidden sm:inline">Markdown supported</span>
        </div>

        <div role="tablist" aria-label="Deliverable summary editor" className="flex items-center gap-1 bg-[#111113] p-0.5 rounded-lg border border-[#27272a]">
          {(['write', 'preview'] as EditorTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              data-testid={`markdown-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                activeTab === tab ? 'bg-indigo-600 text-white' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'write' ? (
        <div role="tabpanel">
          <textarea
            ref={textareaRef}
            data-testid="markdown-editor"
            rows={rows}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full px-3.5 py-3 bg-transparent text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none resize-y font-mono leading-relaxed"
          />
        </div>
      ) : (
        <div
          role="tabpanel"
          data-testid="markdown-preview"
          className="min-h-[180px] px-4 py-3 text-sm text-[#d4d4d8] leading-relaxed overflow-y-auto max-h-[360px] [&_a]:text-indigo-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#3f3f46] [&_blockquote]:pl-3 [&_blockquote]:text-[#a1a1aa] [&_code]:bg-[#232326] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_li]:list-item [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:my-2 [&_pre]:bg-[#0b0b10] [&_pre]:border [&_pre]:border-[#27272a] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_strong]:font-bold [&_strong]:text-white [&_ul]:list-disc [&_ul]:my-2"
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, href }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            ) }}>
              {value}
            </ReactMarkdown>
          ) : (
            <span className="text-[#71717a] italic">Nothing to preview yet.</span>
          )}
        </div>
      )}
    </div>
  );
}

export default MarkdownDeliverableEditor;
