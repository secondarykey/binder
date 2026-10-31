import { describe, it, expect } from 'vitest';
import { extractHeadings, headingPlainText, findHeadingLine } from '@shared/editor/outline';

describe('extractHeadings', () => {
  it('picks up ATX headings with their level and line', () => {
    const text = '# Title\n\ntext\n## Section ##\n### Sub';
    expect(extractHeadings(text)).toEqual([
      { level: 1, text: 'Title', line: 1 },
      { level: 2, text: 'Section', line: 4 },
      { level: 3, text: 'Sub', line: 5 },
    ]);
  });

  it('skips headings inside fenced code', () => {
    const text = '```md\n# not a heading\n```\n~~~~\n# no\n~~~\n# still code\n~~~~\n# Yes';
    expect(extractHeadings(text)).toEqual([{ level: 1, text: 'Yes', line: 9 }]);
  });

  it('skips lines that are not headings', () => {
    const text = '#hashtag\n####### seven\n    # indented code\n#\n# C#';
    expect(extractHeadings(text)).toEqual([{ level: 1, text: 'C#', line: 5 }]);
  });

  it('handles CRLF line endings', () => {
    expect(extractHeadings('# A\r\ntext\r\n## B\r\n')).toEqual([
      { level: 1, text: 'A', line: 1 },
      { level: 2, text: 'B', line: 3 },
    ]);
  });
});

describe('headingPlainText', () => {
  it('drops inline markup', () => {
    expect(headingPlainText('**Bold** and `code`')).toBe('Bold and code');
    expect(headingPlainText('[Link](https://example.com) ~~old~~ *em*')).toBe('Link old em');
    expect(headingPlainText('<span>tag</span> \# escaped')).toBe('tag # escaped');
  });

  it('keeps underscores inside words', () => {
    expect(headingPlainText('snake_case_name')).toBe('snake_case_name');
    expect(headingPlainText('_em_ word')).toBe('em word');
  });
});

describe('findHeadingLine', () => {
  const headings = extractHeadings('# A\n## B\ntext\n## B\n## {{.This.Name}}');

  it('finds the heading by text and occurrence', () => {
    expect(findHeadingLine(headings, { text: 'B', occurrence: 0 })).toBe(2);
    expect(findHeadingLine(headings, { text: ' B ', occurrence: 1, srcLine: 99 })).toBe(4);
  });

  it('falls back to the source line when the text does not match', () => {
    expect(findHeadingLine(headings, { text: 'Note name', occurrence: 0, srcLine: 5 })).toBe(5);
    expect(findHeadingLine(headings, { text: 'Note name', occurrence: 0 })).toBeNull();
  });
});
