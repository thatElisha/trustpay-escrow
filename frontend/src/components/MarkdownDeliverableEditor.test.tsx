import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownDeliverableEditor } from './MarkdownDeliverableEditor';

function EditorHarness() {
  const [value, setValue] = useState('');
  return <MarkdownDeliverableEditor value={value} onChange={setValue} />;
}

describe('MarkdownDeliverableEditor', () => {
  it('inserts bold, bullet list, and code block formatting', () => {
    render(<EditorHarness />);
    const editor = screen.getByTestId('markdown-editor') as HTMLTextAreaElement;

    fireEvent.click(screen.getByTestId('markdown-bold'));
    expect(editor.value).toBe('**bold text**');

    fireEvent.change(editor, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('markdown-list'));
    expect(editor.value).toBe('- List item');

    fireEvent.change(editor, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('markdown-code'));
    expect(editor.value).toContain('```');
    expect(editor.value).toContain('const result = await verify();');
  });

  it('renders a live markdown preview with headings, bold text, lists, and code', () => {
    render(<EditorHarness />);
    const editor = screen.getByTestId('markdown-editor');

    fireEvent.change(editor, {
      target: { value: '# Summary\n\n**Verified** deliverables\n\n- Unit tests\n- Architecture notes\n\n```ts\nconst x = 1;\n```' },
    });
    fireEvent.click(screen.getByTestId('markdown-tab-preview'));

    const preview = screen.getByTestId('markdown-preview');
    expect(preview.querySelector('h1')?.textContent).toBe('Summary');
    expect(preview.querySelector('strong')?.textContent).toBe('Verified');
    expect(preview.querySelectorAll('li')).toHaveLength(2);
    expect(preview.querySelector('pre code')?.textContent).toContain('const x = 1;');
  });

  it('wraps the current selection with bold markers', () => {
    render(<EditorHarness />);
    const editor = screen.getByTestId('markdown-editor') as HTMLTextAreaElement;

    fireEvent.change(editor, { target: { value: 'release notes' } });
    editor.setSelectionRange(0, 7);
    fireEvent.click(screen.getByTestId('markdown-bold'));

    expect(editor.value).toBe('**release** notes');
  });
});
