// ABOUT: Pure HTML renderer for the GSC dashboard widget.
// ABOUT: Takes a WidgetViewModel and returns the inner HTML of the widget.
// ABOUT: Server-side only — eliminates the client's duplicate view-model
// ABOUT: and the client's escapeHtml attack surface (see issue #37).

import type { WidgetViewModel, WidgetAlert, WidgetKpiTile, WidgetTopQuery } from './gscWidgetViewModel';
import { escapeHtml } from './utils';

const PROPERTY_URL = 'sc-domain:hultberg.org';
const GSC_CONSOLE_LINK =
  'https://search.google.com/search-console?resource_id=' + encodeURIComponent(PROPERTY_URL);

/**
 * Render the widget as an HTML fragment. The output is inserted directly
 * into the admin dashboard page at cold-load, and returned from the refresh
 * endpoint to replace `#gsc-widget-root` innerHTML after a manual refresh.
 *
 * Every dynamic string is escaped at the render boundary; all text fields
 * in the view-model are treated as untrusted.
 */
export function renderWidget(vm: WidgetViewModel): string {
  if (vm.state === 'empty') {
    return renderEmpty(vm);
  }

  const freshnessClass = vm.state === 'stale' ? ' stale' : '';
  const freshnessAriaAttr = vm.state === 'stale'
    ? ` aria-label="Stale: ${escapeHtml(vm.freshnessLabel)}"`
    : '';
  const freshnessText = vm.state === 'stale'
    ? `Stale · ${escapeHtml(vm.freshnessLabel)}`
    : escapeHtml(vm.freshnessLabel);

  return `
    <section class="widget" aria-label="Search visibility">
      <div class="widget-header">
        <h2>Search visibility (<a href="${GSC_CONSOLE_LINK}" target="_blank" rel="noopener">GSC</a>)</h2>
        <span class="freshness${freshnessClass}"${freshnessAriaAttr}>${freshnessText}</span>
        <button class="refresh" type="button" id="gsc-refresh-btn">↻ Refresh</button>
      </div>
      ${vm.caveat ? `<div class="widget-caveat" role="status">${escapeHtml(vm.caveat)}</div>` : ''}
      ${renderAlerts(vm.alerts)}
      ${vm.kpis.length > 0 ? renderKpis(vm.kpis) : ''}
      ${vm.topQueries.length > 0 ? renderQueries(vm.topQueries) : ''}
      ${renderFooter(vm)}
    </section>
  `.trim();
}

function renderEmpty(vm: WidgetViewModel): string {
  return `
    <section class="widget" aria-label="Search visibility">
      <div class="widget-header">
        <h2>Search visibility (<a href="${GSC_CONSOLE_LINK}" target="_blank" rel="noopener">GSC</a>)</h2>
        <span class="freshness">${escapeHtml(vm.freshnessLabel)}</span>
        <button class="refresh" type="button" id="gsc-refresh-btn">↻ Refresh</button>
      </div>
      ${renderFooter(vm)}
    </section>
  `.trim();
}

function renderAlerts(alerts: WidgetAlert[]): string {
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

function renderKpis(kpis: WidgetKpiTile[]): string {
  const tiles = kpis.map((k) => {
    const deltaClass = k.deltaClass !== 'flat' ? ` delta ${escapeHtml(k.deltaClass)}` : '';
    return `
      <div class="tile">
        <div class="label">${escapeHtml(k.label)}</div>
        <div class="value">${escapeHtml(k.value)}</div>
        <div class="sub${deltaClass}">${escapeHtml(k.sub)}</div>
      </div>
    `;
  }).join('');
  return `<div class="tiles">${tiles}</div>`;
}

function renderQueries(queries: WidgetTopQuery[]): string {
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

function renderFooter(vm: WidgetViewModel): string {
  const delivery = vm.emailDelivery;
  const recency = vm.manualCheckRecency;
  return `
    <div class="gsc-footer">
      <span class="email-delivery ${escapeHtml(delivery.kind)}">Email delivery: ${escapeHtml(delivery.label)}</span>
      <span class="manual-check">${escapeHtml(recency.label)} — Google emails you directly for manual actions and security issues. <a id="gsc-manual-check-link" href="https://search.google.com/search-console/manual-actions" target="_blank" rel="noopener">Check Search Console ↗</a></span>
    </div>
  `;
}
