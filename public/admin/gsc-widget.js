// ABOUT: Client-side renderer for the GSC Search-visibility widget.
// ABOUT: Fetches /admin/api/gsc-status and renders into #gsc-widget-root.
// ABOUT: The view-model transformation lives server-side in src/gscWidgetViewModel.ts
// ABOUT: and is executed by the backend; this script only handles DOM mutation
// ABOUT: and user interaction (refresh button).

(function () {
  'use strict';

  const ROOT_ID = 'gsc-widget-root';
  const PROPERTY_URL = 'sc-domain:hultberg.org';
  const GSC_CONSOLE_LINK = 'https://search.google.com/search-console?resource_id=' + encodeURIComponent(PROPERTY_URL);

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function render(vm) {
    // freshnessAria is a pre-built attribute string interpolated raw into the
    // template literal below. Safe because vm.freshnessLabel is integer-derived
    // (computed from age in hours/days) and we still escape it. If you ever
    // route attacker-influenced content through here, escape at the *value*
    // boundary AND verify the attribute syntax can't be broken out of.
    var freshnessAria = vm.state === 'stale'
      ? 'aria-label="Stale: ' + escapeHtml(vm.freshnessLabel) + '"'
      : '';
    var freshnessText = vm.state === 'stale'
      ? 'Stale · ' + escapeHtml(vm.freshnessLabel)
      : escapeHtml(vm.freshnessLabel);
    return `
      <section class="widget" aria-label="Search visibility">
        <div class="widget-header">
          <h2>Search visibility (<a href="${GSC_CONSOLE_LINK}" target="_blank" rel="noopener">GSC</a>)</h2>
          <span class="freshness ${vm.state === 'stale' ? 'stale' : ''}" ${freshnessAria}>${freshnessText}</span>
          <button class="refresh" type="button" id="gsc-refresh-btn">↻ Refresh</button>
        </div>
        ${vm.caveat ? '<div class="widget-caveat" role="status">' + escapeHtml(vm.caveat) + '</div>' : ''}
        ${renderAlerts(vm.alerts)}
        ${vm.kpis.length > 0 ? renderKpis(vm.kpis) : ''}
        ${vm.topQueries.length > 0 ? renderQueries(vm.topQueries) : ''}
        ${renderFooter(vm)}
      </section>
    `;
  }

  function renderAlerts(alerts) {
    if (alerts.length === 0) return '';
    const items = alerts.map((a) => `
      <div class="alert ${escapeHtml(a.severity)}">
        <span class="icon">${a.severity === 'high' ? '🔴' : '⚠️'}</span>
        <div class="body">
          <div class="title">${escapeHtml(a.subject)}</div>
          <div class="meta">${escapeHtml(a.message)} Seen for ${escapeHtml(String(a.daysSeen))} ${a.daysSeen === 1 ? 'day' : 'days'}.${a.emailSent ? ' Email sent.' : ''}</div>
        </div>
      </div>
    `).join('');
    return `<div class="alerts">${items}</div>`;
  }

  function renderKpis(kpis) {
    const tiles = kpis.map((k) => `
      <div class="tile">
        <div class="label">${escapeHtml(k.label)}</div>
        <div class="value">${escapeHtml(k.value)}</div>
        <div class="sub ${k.deltaClass !== 'flat' ? 'delta ' + escapeHtml(k.deltaClass) : ''}">${escapeHtml(k.sub)}</div>
      </div>
    `).join('');
    return `<div class="tiles">${tiles}</div>`;
  }

  function renderQueries(queries) {
    const rows = queries.map((q) => `
      <tr>
        <td class="query">${escapeHtml(q.query)}</td>
        <td class="metrics">
          <span class="clicks">${escapeHtml(String(q.clicks))}</span>
          ${escapeHtml(Number(q.impressions).toLocaleString())} impr · ${escapeHtml(q.ctrPct)} CTR · pos ${escapeHtml(q.position)}
        </td>
      </tr>
    `).join('');
    return `
      <div class="queries">
        <h3>Top queries · last 28 days</h3>
        <table>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderFooter(vm) {
    const delivery = vm.emailDelivery;
    return `
      <div class="gsc-footer">
        <span class="email-delivery ${escapeHtml(delivery.kind)}">Email delivery: ${escapeHtml(delivery.label)}</span>
        <span class="manual-check">Manual actions &amp; security issues aren't in the GSC API — Google emails you directly. <a href="https://search.google.com/search-console/manual-actions" target="_blank" rel="noopener">Check Search Console ↗</a></span>
      </div>
    `;
  }

  function renderLoading() {
    return '<section class="widget" aria-label="Search visibility"><div class="widget-body"><em>Loading search visibility…</em></div></section>';
  }

  function renderError(message) {
    return `<section class="widget" aria-label="Search visibility"><div class="widget-body error">Failed to load: ${escapeHtml(message)}</div></section>`;
  }

  async function fetchViewModel() {
    const response = await fetch('/admin/api/gsc-status', { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('Status API returned ' + response.status);
    }
    const body = await response.json();
    if (!body.ok) {
      throw new Error(body.error || 'Unknown error');
    }
    return computeViewModel(body.snapshot, new Date());
  }

  // Mirror of src/gscWidgetViewModel.ts. Duplicated here because the worker
  // sends the raw snapshot (smaller payload + no server-side date baked in)
  // and the client computes the view with its own "now". Tests cover the
  // server-side copy; behaviour must match.
  function computeViewModel(snapshot, now) {
    if (!snapshot) {
      return {
        state: 'empty',
        freshnessLabel: 'No data yet — the first poll runs daily at 08:00 UTC.',
        alerts: [],
        kpis: [],
        topQueries: [],
        emailDelivery: { label: 'Never attempted', kind: 'idle' },
      };
    }
    const ageHours = Math.max(0, Math.floor((now - new Date(snapshot.capturedAt)) / 3600000));
    const isStale = ageHours >= 36;
    var widgetAlerts = snapshot.alerts.map(function (a) {
      // Back-compat: alerts written by PR #29's cron lack firstDetectedAt.
      // Mirrors the fallback in src/gscWidgetViewModel.ts (which uses ??).
      // We use || here intentionally — also catches accidentally-empty-string
      // values (which `??` would let through and then `new Date('')` would
      // produce Invalid Date).
      var firstDetectedAt = a.firstDetectedAt || a.detectedAt || snapshot.capturedAt;
      return {
        type: a.type, severity: a.severity, subject: a.subject, message: a.message,
        firstDetectedAt: firstDetectedAt,
        daysSeen: Math.max(1, Math.floor((now - new Date(firstDetectedAt)) / 86400000) + 1),
        emailSent: a.emailSent,
      };
    });
    // Treat undefined source as 'cron' (back-compat).
    var caveat = snapshot.source === 'manual' && widgetAlerts.some(function (a) { return !a.emailSent; })
      ? 'Manual refresh — alerts emailed at next 08:00 UTC cron.'
      : undefined;
    var vm = {
      state: isStale ? 'stale' : 'fresh',
      freshnessLabel: freshnessLabel(ageHours),
      alerts: widgetAlerts,
      kpis: buildKpis(snapshot),
      topQueries: snapshot.performance.topQueries.map((q) => ({
        query: q.query, clicks: q.clicks, impressions: q.impressions,
        ctrPct: (q.ctr * 100).toFixed(1) + '%',
        position: q.position.toFixed(1),
      })),
      emailDelivery: buildEmailDelivery(snapshot, now),
    };
    if (caveat !== undefined) vm.caveat = caveat;
    return vm;
  }

  function freshnessLabel(hours) {
    if (hours === 0) return 'Refreshed moments ago';
    if (hours === 1) return 'Refreshed 1 hour ago';
    if (hours < 24) return 'Refreshed ' + hours + ' hours ago';
    const days = Math.floor(hours / 24);
    return days === 1 ? 'Refreshed 1 day ago' : 'Refreshed ' + days + ' days ago';
  }

  function buildKpis(snapshot) {
    const sm = snapshot.sitemaps[0];
    const submitted = sm ? sm.submitted : 0;
    const indexed = sm ? sm.indexed : 0;
    const perf = snapshot.performance;
    const clicksDelta = perf.priorPeriodClicks > 0 ? (perf.totalClicks - perf.priorPeriodClicks) / perf.priorPeriodClicks : 0;
    const imprDelta = perf.priorPeriodImpressions > 0 ? (perf.totalImpressions - perf.priorPeriodImpressions) / perf.priorPeriodImpressions : 0;
    const deltaClass = (d) => d > 0.02 ? 'up' : d < -0.02 ? 'down' : 'flat';
    const fmt = (d) => d === 0 ? 'no change vs prior 28d' : ((d > 0 ? '+' : '') + Math.round(d * 100) + '% vs prior 28d');
    return [
      { label: 'Indexed pages', value: String(snapshot.indexing.indexedCount), sub: '', deltaClass: 'flat' },
      { label: 'Sitemap', value: submitted === 0 ? '0' : (indexed + ' / ' + submitted), sub: 'indexed / submitted', deltaClass: 'flat' },
      { label: 'Clicks (28d)', value: String(perf.totalClicks), sub: fmt(clicksDelta), deltaClass: deltaClass(clicksDelta) },
      { label: 'Impressions (28d)', value: String(perf.totalImpressions), sub: fmt(imprDelta), deltaClass: deltaClass(imprDelta) },
    ];
  }

  function buildEmailDelivery(snapshot, now) {
    const d = snapshot.emailDelivery;
    if (!d.lastProvider && !d.lastSuccessAt && !d.lastErrorAt) {
      return { label: 'Never attempted', kind: 'idle' };
    }
    const rel = (iso) => {
      if (!iso) return 'recently';
      const h = Math.max(0, Math.floor((now - new Date(iso)) / 3600000));
      if (h < 1) return 'just now';
      if (h === 1) return '1h ago';
      if (h < 24) return h + 'h ago';
      const days = Math.floor(h / 24);
      return days === 1 ? '1d ago' : days + 'd ago';
    };
    if (d.lastProvider === 'none') return { label: 'Both providers failed · ' + rel(d.lastErrorAt), kind: 'error' };
    if (d.lastProvider === 'resend') return { label: 'Resend (fallback) · ' + rel(d.lastSuccessAt), kind: 'warn' };
    if (d.lastProvider === 'cf') return { label: 'CF · ' + rel(d.lastSuccessAt), kind: 'ok' };
    return { label: 'Never attempted', kind: 'idle' };
  }

  async function doRefresh() {
    const btn = document.getElementById('gsc-refresh-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
    clearRefreshError();
    try {
      const response = await fetch('/admin/api/refresh-gsc', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const body = await response.json().catch(function () { return {}; });
        throw new Error(body.error || ('Refresh failed: ' + response.status));
      }
      await load();
    } catch (err) {
      // Non-destructive: show error as a banner ABOVE the widget header.
      // The widget content (alerts, KPIs, queries) stays intact and the
      // refresh button is restored so the user can try again. Critically,
      // the 429 rate-limit case (which is *expected* behaviour) doesn't
      // destroy the UI.
      showRefreshError(err.message);
      restoreRefreshButton();
    }
  }

  function showRefreshError(message) {
    var widget = document.querySelector('#' + ROOT_ID + ' .widget');
    if (!widget) return;
    var existing = document.getElementById('gsc-refresh-error');
    if (existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'gsc-refresh-error';
    banner.className = 'refresh-error';
    banner.setAttribute('role', 'alert');
    banner.innerHTML =
      '<span class="msg">Refresh failed: ' + escapeHtml(message) + '</span>' +
      '<button type="button" class="dismiss" aria-label="Dismiss">×</button>';
    widget.insertBefore(banner, widget.firstChild);
    var dismissBtn = banner.querySelector('.dismiss');
    if (dismissBtn) dismissBtn.addEventListener('click', clearRefreshError);
  }

  function clearRefreshError() {
    var existing = document.getElementById('gsc-refresh-error');
    if (existing) existing.remove();
  }

  function restoreRefreshButton() {
    var btn = document.getElementById('gsc-refresh-btn');
    if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; }
  }

  async function load() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.innerHTML = renderLoading();
    try {
      const vm = await fetchViewModel();
      root.innerHTML = render(vm);
      const btn = document.getElementById('gsc-refresh-btn');
      if (btn) btn.addEventListener('click', doRefresh);
    } catch (err) {
      root.innerHTML = renderError(err.message);
    }
  }

  // Test hook: a JSDOM test sets `window.__gscWidgetTest = {}` BEFORE this
  // script runs, then reads `window.__gscWidgetTest.api` to invoke individual
  // helpers. Production browsers never set this, so the auto-load runs as
  // normal. The reference is harmless either way.
  if (typeof window !== 'undefined' && window.__gscWidgetTest) {
    window.__gscWidgetTest.api = {
      escapeHtml: escapeHtml,
      showRefreshError: showRefreshError,
      clearRefreshError: clearRefreshError,
      restoreRefreshButton: restoreRefreshButton,
      computeViewModel: computeViewModel,
    };
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
