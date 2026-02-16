// ABOUT: Tests for TypeScript type definitions
// ABOUT: Validates data structure compliance

import { describe, it, expect } from 'vitest';
import type { Update, UpdateStatus, UpdateIndexEntry, UpdateIndex } from '@/types';

describe('Type Definitions', () => {
  describe('UpdateStatus', () => {
    it('allows valid status values', () => {
      const validStatuses: UpdateStatus[] = ['draft', 'published', 'unpublished'];

      validStatuses.forEach(status => {
        const update: Partial<Update> = { status };
        expect(update.status).toBe(status);
      });
    });
  });

  describe('Update interface', () => {
    it('enforces required fields', () => {
      const validUpdate: Update = {
        slug: 'test-slug',
        title: 'Test Title',
        excerpt: '',
        content: '# Test Content',
        status: 'draft',
        publishedDate: '',
        editedDate: '2026-02-16T10:00:00Z',
        author: 'Magnus Hultberg',
        images: [],
      };

      expect(validUpdate.slug).toBe('test-slug');
      expect(validUpdate.title).toBe('Test Title');
      expect(validUpdate.images).toEqual([]);
      expect(validUpdate.status).toBe('draft');
    });

    it('allows empty excerpt for auto-generation', () => {
      const update: Update = {
        slug: 'test',
        title: 'Test',
        excerpt: '', // Empty excerpt should be allowed
        content: 'Content',
        status: 'published',
        publishedDate: '2026-02-16T10:00:00Z',
        editedDate: '2026-02-16T10:00:00Z',
        author: 'Magnus Hultberg',
        images: [],
      };

      expect(update.excerpt).toBe('');
    });

    it('supports all status values', () => {
      const statuses: UpdateStatus[] = ['draft', 'published', 'unpublished'];

      statuses.forEach(status => {
        const update: Update = {
          slug: 'test',
          title: 'Test',
          excerpt: '',
          content: 'Content',
          status,
          publishedDate: status === 'draft' ? '' : '2026-02-16T10:00:00Z',
          editedDate: '2026-02-16T10:00:00Z',
          author: 'Magnus Hultberg',
          images: [],
        };

        expect(update.status).toBe(status);
      });
    });
  });

  describe('UpdateIndexEntry interface', () => {
    it('contains required fields for listing page', () => {
      const entry: UpdateIndexEntry = {
        slug: 'test-update',
        title: 'Test Update',
        excerpt: 'Test excerpt',
        publishedDate: '2026-02-16T10:00:00Z',
        status: 'published',
      };

      expect(entry.slug).toBe('test-update');
      expect(entry.title).toBe('Test Update');
      expect(entry.excerpt).toBe('Test excerpt');
      expect(entry.publishedDate).toBe('2026-02-16T10:00:00Z');
      expect(entry.status).toBe('published');
    });
  });

  describe('UpdateIndex interface', () => {
    it('contains array of update entries', () => {
      const index: UpdateIndex = {
        updates: [
          {
            slug: 'test',
            title: 'Test',
            excerpt: 'Test excerpt',
            publishedDate: '2026-02-16T10:00:00Z',
            status: 'published',
          },
        ],
      };

      expect(index.updates).toHaveLength(1);
      expect(index.updates[0].status).toBe('published');
    });

    it('allows empty updates array', () => {
      const index: UpdateIndex = {
        updates: [],
      };

      expect(index.updates).toHaveLength(0);
      expect(Array.isArray(index.updates)).toBe(true);
    });

    it('supports multiple updates', () => {
      const index: UpdateIndex = {
        updates: [
          {
            slug: 'first',
            title: 'First',
            excerpt: 'First excerpt',
            publishedDate: '2026-02-15T10:00:00Z',
            status: 'published',
          },
          {
            slug: 'second',
            title: 'Second',
            excerpt: 'Second excerpt',
            publishedDate: '2026-02-16T10:00:00Z',
            status: 'published',
          },
        ],
      };

      expect(index.updates).toHaveLength(2);
      expect(index.updates[0].slug).toBe('first');
      expect(index.updates[1].slug).toBe('second');
    });
  });
});
