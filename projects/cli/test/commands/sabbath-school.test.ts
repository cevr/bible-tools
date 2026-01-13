import { beforeEach, describe, expect, it } from 'vitest';

import { sabbathSchool } from '../../core/sabbath-school/sabbath-school.js';
import {
  expectCallCount,
  expectContains,
  expectNoCalls,
  expectSequence,
  runCli,
} from '../lib/run-cli.js';

describe('sabbath-school commands', () => {
  beforeEach(() => {
    // Reset test state
  });

  describe('process command', () => {
    it('should skip already processed weeks', async () => {
      const result = await runCli(
        sabbathSchool,
        [
          'process',
          '--year',
          '2024',
          '--quarter',
          '1',
          '--week',
          '1',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              // Outline already exists
              [`${process.cwd()}/outputs/sabbath-school/2024-Q1-W1.md`]:
                '# Existing Outline\n\nContent here.',
            },
            directories: [`${process.cwd()}/outputs/sabbath-school`],
          },
          model: {
            responses: { high: [], low: [] },
          },
          http: {
            responses: {
              'https://www.sabbath.school/LessonBook': {
                status: 200,
                body: `
                  <a class="btn-u btn-u-sm" href="https://example.com/lesson1.pdf">Teachers PDF</a>
                  <a class="btn-u btn-u-sm" href="https://example.com/egw1.pdf">EGW Notes PDF</a>
                `,
              },
            },
          },
        },
      );

      expect(result.success).toBe(true);
      // Should check if file exists but not generate new content
      expectContains(result.calls, [{ _tag: 'FileSystem.exists' }]);
      // No model calls because file already exists
      expectNoCalls(result.calls, 'Model.generateText');
    });

    it('should download PDFs and generate outline for missing week', async () => {
      const mockHtml = `
        <a class="btn-u btn-u-sm" href="https://example.com/lesson1.pdf">Teachers PDF</a>
        <a class="btn-u btn-u-sm" href="https://example.com/egw1.pdf">EGW Notes PDF</a>
      `;

      const result = await runCli(
        sabbathSchool,
        [
          'process',
          '--year',
          '2024',
          '--quarter',
          '1',
          '--week',
          '1',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {},
            directories: [],
          },
          model: {
            responses: {
              high: [
                // generateOutline response
                '# Generated Outline\n\n## Introduction\n\nContent...',
                // review check response (no revision needed)
                { needsRevision: false, revisionPoints: [], comments: '' },
              ],
              low: [],
            },
          },
          http: {
            responses: {
              'https://www.sabbath.school/LessonBook': {
                status: 200,
                body: mockHtml,
              },
              'https://example.com/lesson1.pdf': {
                status: 200,
                body: new ArrayBuffer(100),
              },
              'https://example.com/egw1.pdf': {
                status: 200,
                body: new ArrayBuffer(100),
              },
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.exists' },
        { _tag: 'HTTP.fetch' }, // sabbath.school page
        { _tag: 'HTTP.fetch' }, // lesson PDF
        { _tag: 'HTTP.fetch' }, // EGW PDF
        { _tag: 'Model.generateText' }, // generateOutline
        { _tag: 'Model.generateObject' }, // review check
        { _tag: 'FileSystem.writeFile' }, // save outline
      ]);
    });

    it('should revise outline when review indicates issues', async () => {
      const mockHtml = `
        <a class="btn-u btn-u-sm" href="https://example.com/lesson1.pdf">Teachers PDF</a>
        <a class="btn-u btn-u-sm" href="https://example.com/egw1.pdf">EGW Notes PDF</a>
      `;

      const result = await runCli(
        sabbathSchool,
        [
          'process',
          '--year',
          '2024',
          '--quarter',
          '1',
          '--week',
          '1',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {},
            directories: [],
          },
          model: {
            responses: {
              high: [
                // generateOutline response
                '# Initial Outline\n\nNeeds work...',
                // review check response (revision needed)
                {
                  needsRevision: true,
                  revisionPoints: ['Needs more detail'],
                  comments: 'Add more scripture references',
                },
                // revised outline
                '# Revised Outline\n\n## Better Content\n\nImproved...',
              ],
              low: [],
            },
          },
          http: {
            responses: {
              'https://www.sabbath.school/LessonBook': {
                status: 200,
                body: mockHtml,
              },
              'https://example.com/lesson1.pdf': {
                status: 200,
                body: new ArrayBuffer(100),
              },
              'https://example.com/egw1.pdf': {
                status: 200,
                body: new ArrayBuffer(100),
              },
            },
          },
        },
      );

      expect(result.success).toBe(true);
      // Should have 2 generateText calls: generate + revise
      expectCallCount(result.calls, 'Model.generateText', 2);
      // Should have 1 generateObject call: review
      expectCallCount(result.calls, 'Model.generateObject', 1);
    });
  });

  describe('revise command', () => {
    it('should revise existing outline', async () => {
      const result = await runCli(
        sabbathSchool,
        [
          'revise',
          '--year',
          '2024',
          '--quarter',
          '1',
          '--week',
          '1',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              [`${process.cwd()}/outputs/sabbath-school/2024-Q1-W1.md`]:
                '# Original Outline\n\nOriginal content...',
            },
            directories: [`${process.cwd()}/outputs/sabbath-school`],
          },
          model: {
            responses: {
              high: [
                // review check (needs revision)
                {
                  needsRevision: true,
                  revisionPoints: ['Point 1'],
                  comments: 'Needs improvement',
                },
                // revised content
                '# Revised Outline\n\nImproved content...',
              ],
              low: [],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.exists' },
        { _tag: 'FileSystem.readFile' },
        { _tag: 'Model.generateObject' }, // review
        { _tag: 'Model.generateText' }, // revise
        { _tag: 'FileSystem.writeFile' },
      ]);
    });

    it('should skip revision when not needed', async () => {
      const result = await runCli(
        sabbathSchool,
        [
          'revise',
          '--year',
          '2024',
          '--quarter',
          '1',
          '--week',
          '1',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              [`${process.cwd()}/outputs/sabbath-school/2024-Q1-W1.md`]:
                '# Good Outline\n\nContent is already good...',
            },
            directories: [`${process.cwd()}/outputs/sabbath-school`],
          },
          model: {
            responses: {
              high: [
                // review check (no revision needed)
                {
                  needsRevision: false,
                  revisionPoints: [],
                  comments: 'Looks good!',
                },
              ],
              low: [],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      // Should only have review check, no revision
      expectCallCount(result.calls, 'Model.generateObject', 1);
      expectNoCalls(result.calls, 'Model.generateText');
      // Should not write since no changes
      const writeCount = result.calls.filter(
        (c) => c._tag === 'FileSystem.writeFile',
      ).length;
      expect(writeCount).toBe(0);
    });

    it('should handle missing outline file', async () => {
      const result = await runCli(
        sabbathSchool,
        [
          'revise',
          '--year',
          '2024',
          '--quarter',
          '1',
          '--week',
          '1',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {},
            directories: [],
          },
          model: {
            responses: { high: [], low: [] },
          },
        },
      );

      expect(result.success).toBe(true);
      // No model calls since file doesn't exist
      expectNoCalls(result.calls, 'Model.generateText');
      expectNoCalls(result.calls, 'Model.generateObject');
    });
  });

  describe('export command', () => {
    it('should export outline to Apple Notes', async () => {
      const result = await runCli(
        sabbathSchool,
        ['export', '--year', '2024', '--quarter', '1', '--week', '1'],
        {
          files: {
            files: {
              [`${process.cwd()}/outputs/sabbath-school/2024-Q1-W1.md`]:
                '# Outline to Export\n\nContent to export...',
            },
            directories: [`${process.cwd()}/outputs/sabbath-school`],
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.exists' },
        { _tag: 'FileSystem.readFile' },
        { _tag: 'AppleScript.exec' },
      ]);
    });

    it('should handle missing file for export', async () => {
      const result = await runCli(
        sabbathSchool,
        ['export', '--year', '2024', '--quarter', '1', '--week', '1'],
        {
          files: {
            files: {},
            directories: [],
          },
        },
      );

      expect(result.success).toBe(true);
      // No export since file doesn't exist
      expectNoCalls(result.calls, 'AppleScript.exec');
    });
  });
});
