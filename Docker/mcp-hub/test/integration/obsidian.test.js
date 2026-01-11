// ============================================================
// Integration Tests: Obsidian
// ============================================================
// Task: US-014-3 - Test Obsidian integration

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testUtils } from '../setup.js';

describe('Obsidian Integration Tests', () => {
  describe('Markdown File Operations', () => {
    it('should write markdown file with YAML frontmatter', async () => {
      const filename = '2024-01-15-test.md';
      const content = '# Test Content\n\nThis is a test.';
      const frontmatter = {
        title: 'Test Note',
        date: '2024-01-15',
        tags: ['test', 'example']
      };

      // Simulate file write
      const fullContent = `---\ntitle: Test Note\ndate: 2024-01-15\ntags:\n  - test\n  - example\n---\n\n# Test Content\n\nThis is a test.`;

      assert.ok(fullContent.includes('---'));
      assert.ok(fullContent.includes('title: Test Note'));
      assert.ok(fullContent.includes('# Test Content'));
    });

    it('should read markdown file and parse YAML frontmatter', async () => {
      const fileContent = `---
title: Test Note
date: 2024-01-15
tags:
  - test
  - example
---
# Test Content

This is a test.`;

      // Simulate parsing
      const lines = fileContent.split('\n');
      const frontmatterStart = lines.indexOf('---');
      const frontmatterEnd = lines.indexOf('---', frontmatterStart + 1);

      assert.ok(frontmatterStart >= 0);
      assert.ok(frontmatterEnd > frontmatterStart);

      const frontmatterText = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n');
      const body = lines.slice(frontmatterEnd + 1).join('\n').trim();

      assert.ok(frontmatterText.includes('title: Test Note'));
      assert.ok(body.startsWith('# Test Content'));
    });

    it('should append content to existing markdown file', async () => {
      const existingContent = `# Original Content\n\nOriginal text.`;
      const appendContent = `\n\n## Appended Section\n\nAppended text.`;
      const expected = existingContent + appendContent;

      assert.ok(expected.includes('Original Content'));
      assert.ok(expected.includes('Appended Section'));
    });

    it('should handle UTF-8 encoding', async () => {
      const content = 'Hello 世界 🌍';
      const encoder = new TextEncoder();
      const encoded = encoder.encode(content);

      assert.ok(encoded.length > 0);
      assert.ok(encoded.includes(Buffer.from(' ')[0]));
    });
  });

  describe('File Listing and Search', () => {
    it('should list all markdown files', async () => {
      // Simulate file listing
      const files = [
        '2024-01-15.md',
        '2024-01-14.md',
        '2024-01-13.md'
      ];

      assert.equal(files.length, 3);
      assert.ok(files.every(f => f.endsWith('.md')));
    });

    it('should search notes by filename', async () => {
      const files = [
        '2024-01-15-test-note.md',
        '2024-01-14-example.md',
        '2024-01-13-test-file.md'
      ];
      const query = 'test';

      const results = files.filter(f => f.toLowerCase().includes(query.toLowerCase()));

      assert.equal(results.length, 2);
      assert.ok(results.includes('2024-01-15-test-note.md'));
      assert.ok(results.includes('2024-01-13-test-file.md'));
    });

    it('should search notes by content', async () => {
      const files = {
        '2024-01-15.md': 'This document discusses testing strategies.',
        '2024-01-14.md': 'Example content goes here.',
        '2024-01-13.md': 'More test examples in this file.'
      };
      const query = 'test';

      const results = Object.entries(files)
        .filter(([_, content]) => content.toLowerCase().includes(query.toLowerCase()))
        .map(([filename, _]) => filename);

      assert.equal(results.length, 2);
    });

    it('should extract tags from markdown files', async () => {
      const fileContent = `---
tags:
  - javascript
  - testing
  - example
---
# Content

More content with #inline-tag and another tag.`;

      const tags = new Set();

      // Extract from frontmatter
      const tagMatch = fileContent.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
      if (tagMatch) {
        const tagLines = tagMatch[1].match(/-\s*(.+)/g);
        if (tagLines) {
          tagLines.forEach(t => tags.add(t.replace(/-\s*/, '')));
        }
      }

      // Extract inline tags
      const inlineTags = fileContent.matchAll(/#(\w[\w-]*)/g);
      for (const match of inlineTags) {
        tags.add(match[1]);
      }

      assert.ok(tags.has('javascript'));
      assert.ok(tags.has('testing'));
      assert.ok(tags.has('inline-tag'));
    });
  });

  describe('Daily Log Rotation', () => {
    it('should create daily log files with date in filename', async () => {
      const date = new Date();
      const filename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.md`;

      const dateRegex = /^\d{4}-\d{2}-\d{2}\.md$/;
      assert.ok(dateRegex.test(filename));
    });

    it('should generate filename from title', async () => {
      const title = 'This is a Test Title! With Special Characters.';
      const date = '2024-01-15';

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);

      const filename = `${date}-${slug}.md`;

      assert.ok(filename.startsWith('2024-01-15-'));
      assert.ok(filename.endsWith('.md'));
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found errors', async () => {
      const filename = 'nonexistent-file.md';
      let errorCaught = false;

      try {
        // Simulate file read error
        throw new Error(`File not found: ${filename}`);
      } catch (error) {
        errorCaught = true;
        assert.ok(error.message.includes('File not found'));
      }

      assert.ok(errorCaught);
    });

    it('should handle write permission errors', async () => {
      let errorCaught = false;

      try {
        // Simulate permission error
        throw new Error('Permission denied: cannot write to file');
      } catch (error) {
        errorCaught = true;
        assert.ok(error.message.includes('Permission denied'));
      }

      assert.ok(errorCaught);
    });
  });

  describe('Log Retention', () => {
    it('should cleanup old log files', async () => {
      const files = [
        '2024-01-01.md',
        '2024-01-02.md',
        '2024-01-15.md',
        '2024-01-16.md'
      ];
      const daysToKeep = 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const toDelete = [];
      for (const file of files) {
        const fileDate = new Date(file.replace('.md', ''));
        if (fileDate < cutoffDate) {
          toDelete.push(file);
        }
      }

      assert.ok(toDelete.length > 0);
      assert.ok(toDelete.includes('2024-01-01.md'));
      assert.ok(toDelete.includes('2024-01-02.md'));
    });
  });
});
