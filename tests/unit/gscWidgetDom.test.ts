// @vitest-environment jsdom
/// <reference lib="dom" />
// ABOUT: JSDOM tests for the DOM-touching helpers in public/admin/gsc-widget.js
// ABOUT: (showRefreshError, clearRefreshError, restoreRefreshButton, escapeHtml).
// ABOUT: Loads the actual widget source via Function() with the test hook enabled
// ABOUT: so we exercise the production code, not a copy.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const widgetSource = readFileSync(
  join(__dirname, '..', '..', 'public', 'admin', 'gsc-widget.js'),
  'utf8',
);

interface WidgetTestApi {
  showRefreshError: (message: string) => void;
  clearRefreshError: () => void;
  restoreRefreshButton: () => void;
  wireHandlers: () => void;
  doRefresh: () => Promise<void>;
}

declare global {
  interface Window {
    __gscWidgetTest?: { api?: WidgetTestApi };
  }
}

function loadWidget(): WidgetTestApi {
  // Set the test hook BEFORE evaluating the script so the IIFE's branch
  // attaches the api and skips the auto-load.
  window.__gscWidgetTest = {};
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(widgetSource).call(window);
  if (!window.__gscWidgetTest.api) {
    throw new Error('gsc-widget.js did not attach the test API — check the test hook gate.');
  }
  return window.__gscWidgetTest.api;
}

describe('gsc-widget DOM helpers', () => {
  let api: WidgetTestApi;

  beforeEach(() => {
    document.body.innerHTML = '';
    api = loadWidget();
  });

  describe('showRefreshError', () => {
    function setupWidget(): HTMLElement {
      document.body.innerHTML = `
        <div id="gsc-widget-root">
          <section class="widget">
            <div class="widget-header">
              <h2>Search visibility</h2>
              <button id="gsc-refresh-btn">↻ Refresh</button>
            </div>
            <div class="alerts"><div class="alert">existing alert content</div></div>
            <div class="tiles"><div class="tile">existing tile</div></div>
          </section>
        </div>
      `;
      return document.querySelector('.widget')!;
    }

    it('inserts a banner above the widget header', () => {
      const widget = setupWidget();
      api.showRefreshError('Rate limit hit — try again in 60s');

      const banner = document.getElementById('gsc-refresh-error');
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toContain('Rate limit hit');
      expect(widget.firstElementChild).toBe(banner);
    });

    it('preserves all existing widget content (alerts, tiles, header)', () => {
      setupWidget();
      api.showRefreshError('whatever');

      expect(document.querySelector('.alerts')!.textContent).toContain('existing alert content');
      expect(document.querySelector('.tiles')!.textContent).toContain('existing tile');
      expect(document.getElementById('gsc-refresh-btn')).not.toBeNull();
    });

    it('escapes HTML in the error message (XSS defence)', () => {
      setupWidget();
      api.showRefreshError('<img src=x onerror=alert(1)>');

      const banner = document.getElementById('gsc-refresh-error');
      expect(banner!.innerHTML).not.toContain('<img');
      expect(banner!.innerHTML).toContain('&lt;img');
      // Verify no actual img element was injected.
      expect(banner!.querySelector('img')).toBeNull();
    });

    it('replaces an existing banner rather than stacking duplicates', () => {
      setupWidget();
      api.showRefreshError('first error');
      api.showRefreshError('second error');

      const banners = document.querySelectorAll('#gsc-refresh-error');
      expect(banners.length).toBe(1);
      expect(banners[0].textContent).toContain('second error');
      expect(banners[0].textContent).not.toContain('first error');
    });

    it('marks the banner with role="alert" for screen readers', () => {
      setupWidget();
      api.showRefreshError('x');

      const banner = document.getElementById('gsc-refresh-error');
      expect(banner!.getAttribute('role')).toBe('alert');
    });

    it('attaches a working dismiss handler to the × button', () => {
      setupWidget();
      api.showRefreshError('dismissible');

      const dismissBtn = document.querySelector('#gsc-refresh-error .dismiss') as HTMLButtonElement;
      expect(dismissBtn).not.toBeNull();
      dismissBtn.click();

      expect(document.getElementById('gsc-refresh-error')).toBeNull();
    });

    it('is a no-op when there is no .widget element on the page', () => {
      document.body.innerHTML = '<div>no widget here</div>';
      expect(() => api.showRefreshError('x')).not.toThrow();
      expect(document.getElementById('gsc-refresh-error')).toBeNull();
    });
  });

  describe('clearRefreshError', () => {
    it('removes the banner if present', () => {
      document.body.innerHTML = `
        <div id="gsc-widget-root">
          <section class="widget"><div class="widget-header"></div></section>
        </div>
      `;
      api.showRefreshError('temporary');
      expect(document.getElementById('gsc-refresh-error')).not.toBeNull();

      api.clearRefreshError();
      expect(document.getElementById('gsc-refresh-error')).toBeNull();
    });

    it('is a safe no-op when no banner is present', () => {
      document.body.innerHTML = '<div>nothing to clear</div>';
      expect(() => api.clearRefreshError()).not.toThrow();
    });
  });

  describe('restoreRefreshButton', () => {
    it('re-enables the button and resets the text', () => {
      document.body.innerHTML = `
        <button id="gsc-refresh-btn" disabled>Refreshing…</button>
      `;
      api.restoreRefreshButton();

      const btn = document.getElementById('gsc-refresh-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe('↻ Refresh');
    });

    it('is a safe no-op when the button is not on the page', () => {
      document.body.innerHTML = '<div>no refresh button</div>';
      expect(() => api.restoreRefreshButton()).not.toThrow();
    });
  });
});
