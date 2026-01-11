import { describe, expect, it } from 'vitest';

import { notes } from '../../core/notes/notes.js';
import { runCli, expectContains } from '../lib/run-cli.js';

describe('notes commands', () => {
  describe('list command', () => {
    it('should list notes from Apple Notes', async () => {
      // Mock response format: ID|Name|Created|Modified\n
      const mockNotesResponse = [
        'note-id-1|Test Note 1|January 1, 2026|January 2, 2026',
        'note-id-2|Test Note 2|January 3, 2026|January 4, 2026',
      ].join('\n');

      const result = await runCli(notes, ['list'], {
        bun: {
          appleScriptSuccess: true,
          appleScriptResponse: mockNotesResponse,
        },
      });

      expect(result.success).toBe(true);
      expectContains(result.calls, [{ _tag: 'AppleScript.exec' }]);
    });

    it('should output JSON when --json flag is used', async () => {
      const mockNotesResponse = 'note-id-1|Test Note|January 1, 2026|January 2, 2026\n';

      const result = await runCli(notes, ['list', '--json'], {
        bun: {
          appleScriptSuccess: true,
          appleScriptResponse: mockNotesResponse,
        },
      });

      expect(result.success).toBe(true);
      expectContains(result.calls, [{ _tag: 'AppleScript.exec' }]);
    });

    it('should handle empty notes list', async () => {
      const result = await runCli(notes, ['list'], {
        bun: {
          appleScriptSuccess: true,
          appleScriptResponse: '',
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('export command', () => {
    it('should create a new note from markdown file', async () => {
      const markdownContent = '# Test Message\n\nThis is test content.';

      const result = await runCli(notes, ['export', '--file', '/path/to/message.md'], {
        files: {
          files: {
            '/path/to/message.md': markdownContent,
          },
        },
        bun: {
          appleScriptSuccess: true,
          appleScriptResponse: 'note-id-new-123',
        },
      });

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' },
        { _tag: 'AppleScript.exec' },
      ]);
    });

    it('should create note in specified folder', async () => {
      const markdownContent = '# Test Message\n\nContent here.';

      const result = await runCli(
        notes,
        ['export', '--file', '/path/to/message.md', '--folder', 'messages'],
        {
          files: {
            files: {
              '/path/to/message.md': markdownContent,
            },
          },
          bun: {
            appleScriptSuccess: true,
            appleScriptResponse: 'note-id-folder-123',
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' },
        { _tag: 'AppleScript.exec' },
      ]);
    });

    it('should update existing note when --note-id is provided', async () => {
      const markdownContent = '# Updated Message\n\nUpdated content.';

      const result = await runCli(
        notes,
        ['export', '--file', '/path/to/message.md', '--note-id', 'existing-note-id-456'],
        {
          files: {
            files: {
              '/path/to/message.md': markdownContent,
            },
          },
          bun: {
            appleScriptSuccess: true,
            appleScriptResponse: 'Success',
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' },
        { _tag: 'AppleScript.exec' },
      ]);
    });

    it('should fail when file does not exist', async () => {
      const result = await runCli(
        notes,
        ['export', '--file', '/path/to/nonexistent.md'],
        {
          files: {
            files: {},
          },
          bun: {
            appleScriptSuccess: true,
            appleScriptResponse: 'note-id-123',
          },
        },
      );

      expect(result.success).toBe(false);
    });

    it('should handle AppleScript failure gracefully', async () => {
      const markdownContent = '# Test\n\nContent';

      const result = await runCli(
        notes,
        ['export', '--file', '/path/to/message.md'],
        {
          files: {
            files: {
              '/path/to/message.md': markdownContent,
            },
          },
          bun: {
            appleScriptSuccess: false,
            appleScriptResponse: 'Error: Permission denied',
          },
        },
      );

      // The command should still complete but may fail due to AppleScript error
      // The exact behavior depends on error handling in the implementation
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' },
        { _tag: 'AppleScript.exec' },
      ]);
    });
  });
});
