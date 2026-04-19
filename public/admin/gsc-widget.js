// ABOUT: Client-side behaviour for the GSC Search-visibility widget.
// ABOUT: The widget HTML is server-rendered (see src/gscWidgetRenderer.ts)
// ABOUT: and arrives on the page already complete. This script only wires
// ABOUT: the refresh button, the manual-check link, and the refresh-error
// ABOUT: banner. It does NOT build HTML — all dynamic text goes through
// ABOUT: textContent so there is no client-side escape surface.

(function () {
  'use strict';

  const ROOT_ID = 'gsc-widget-root';

  function wireHandlers() {
    var refreshBtn = document.getElementById('gsc-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', doRefresh);

    var manualCheckLink = document.getElementById('gsc-manual-check-link');
    if (manualCheckLink) {
      manualCheckLink.addEventListener('click', function () {
        // keepalive ensures delivery even if the user middle-clicks and
        // immediately closes the current tab. KV write failure is silent —
        // the recency nudge is non-critical.
        fetch('/admin/api/gsc-manual-check-clicked', {
          method: 'POST',
          credentials: 'same-origin',
          keepalive: true,
        }).catch(function () { /* silent */ });
      });
    }
  }

  async function doRefresh() {
    var btn = document.getElementById('gsc-refresh-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
    clearRefreshError();
    try {
      var response = await fetch('/admin/api/refresh-gsc', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      var body = await response.json().catch(function () { return {}; });
      if (!response.ok || !body.ok || !body.widgetHtml) {
        throw new Error(body.error || ('Refresh failed: ' + response.status));
      }
      var root = document.getElementById(ROOT_ID);
      if (root) {
        // Server-rendered fragment — HTML comes from our own Worker code
        // via src/gscWidgetRenderer.ts, where every dynamic field is
        // escaped at the render boundary. No client-side escape needed.
        root.innerHTML = body.widgetHtml;
        wireHandlers();
      }
    } catch (err) {
      // Non-destructive: show error above the widget header, preserve the
      // existing content, re-enable the refresh button so the user can retry.
      showRefreshError(err.message);
      restoreRefreshButton();
    }
  }

  function showRefreshError(message) {
    var widget = document.querySelector('#' + ROOT_ID + ' .widget');
    if (!widget) return;
    clearRefreshError();

    var banner = document.createElement('div');
    banner.id = 'gsc-refresh-error';
    banner.className = 'refresh-error';
    banner.setAttribute('role', 'alert');

    var msg = document.createElement('span');
    msg.className = 'msg';
    // textContent is an inert setter — the browser treats the value as
    // literal text, not markup. No escape surface.
    msg.textContent = 'Refresh failed: ' + message;

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', clearRefreshError);

    banner.appendChild(msg);
    banner.appendChild(dismiss);
    widget.insertBefore(banner, widget.firstChild);
  }

  function clearRefreshError() {
    var existing = document.getElementById('gsc-refresh-error');
    if (existing) existing.remove();
  }

  function restoreRefreshButton() {
    var btn = document.getElementById('gsc-refresh-btn');
    if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; }
  }

  // Test hook: a JSDOM test sets `window.__gscWidgetTest = {}` BEFORE this
  // script runs, then reads `window.__gscWidgetTest.api` to invoke individual
  // helpers. Production browsers never set this, so the auto-wire runs as
  // normal. The reference is harmless either way.
  if (typeof window !== 'undefined' && window.__gscWidgetTest) {
    window.__gscWidgetTest.api = {
      showRefreshError: showRefreshError,
      clearRefreshError: clearRefreshError,
      restoreRefreshButton: restoreRefreshButton,
      wireHandlers: wireHandlers,
      doRefresh: doRefresh,
    };
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireHandlers);
  } else {
    wireHandlers();
  }
})();
