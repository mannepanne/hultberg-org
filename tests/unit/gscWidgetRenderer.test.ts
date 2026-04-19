// ABOUT: Unit tests for the GSC dashboard widget server-side renderer.
// ABOUT: Covers output structure, escaping of every dynamic field, and the
// ABOUT: empty / fresh / stale branches.

import { describe, it, expect } from 'vitest';
import { renderWidget } from '@/gscWidgetRenderer';
import type { WidgetViewModel } from '@/gscWidgetViewModel';

function baseVm(overrides: Partial<WidgetViewModel> = {}): WidgetViewModel {
  return {
    state: 'fresh',
    freshnessLabel: 'Refreshed 4 hours ago',
    alerts: [],
    kpis: [],
    topQueries: [],
    emailDelivery: { label: 'Never attempted', kind: 'idle' },
    manualCheckRecency: { label: 'Never checked in GSC UI', neverClicked: true },
    ...overrides,
  };
}

describe('renderWidget — structure', () => {
  it('produces a <section class="widget"> with the refresh button', () => {
    const html = renderWidget(baseVm());
    expect(html).toContain('<section class="widget" aria-label="Search visibility">');
    expect(html).toContain('id="gsc-refresh-btn"');
  });

  it('embeds the GSC Console link with the property URL encoded', () => {
    const html = renderWidget(baseVm());
    expect(html).toContain('search.google.com/search-console?resource_id=');
    expect(html).toContain('sc-domain%3Ahultberg.org');
  });
});

describe('renderWidget — freshness states', () => {
  it('renders a plain freshness label on fresh snapshots', () => {
    const html = renderWidget(baseVm({ state: 'fresh', freshnessLabel: 'Refreshed 4 hours ago' }));
    expect(html).toContain('>Refreshed 4 hours ago<');
    expect(html).not.toContain('stale');
  });

  it('decorates the freshness label on stale snapshots', () => {
    const html = renderWidget(baseVm({ state: 'stale', freshnessLabel: 'Refreshed 2 days ago' }));
    expect(html).toContain('class="freshness stale"');
    expect(html).toContain('Stale · Refreshed 2 days ago');
    expect(html).toContain('aria-label="Stale: Refreshed 2 days ago"');
  });

  it('renders the empty state without alerts/kpis/queries sections', () => {
    const html = renderWidget(baseVm({
      state: 'empty',
      freshnessLabel: 'No data yet — the first poll runs daily at 08:00 UTC.',
    }));
    expect(html).toContain('No data yet');
    expect(html).not.toContain('class="alerts"');
    expect(html).not.toContain('class="tiles"');
    expect(html).not.toContain('class="queries"');
  });
});

describe('renderWidget — alerts', () => {
  it('omits the alerts div when alerts is empty', () => {
    const html = renderWidget(baseVm({ alerts: [] }));
    expect(html).not.toContain('class="alerts"');
  });

  it('renders a high-severity alert with 🔴 icon and "day" singular', () => {
    const html = renderWidget(baseVm({
      alerts: [{
        type: 'indexed-drop', severity: 'high',
        subject: 'Indexed pages dropped 50%',
        message: 'Observed 10 indexed (was 20).',
        firstDetectedAt: '2026-04-18T00:00:00Z',
        daysSeen: 1,
        emailSent: true,
      }],
    }));
    expect(html).toContain('<div class="alert high">');
    expect(html).toContain('🔴');
    expect(html).toContain('Indexed pages dropped 50%');
    expect(html).toContain('Seen for 1 day');
    expect(html).toContain('Email sent.');
  });

  it('renders a medium-severity alert with ⚠️ icon and "days" plural', () => {
    const html = renderWidget(baseVm({
      alerts: [{
        type: 'impressions-drop', severity: 'medium',
        subject: 'Impressions dropped',
        message: 'Impressions down 30%.',
        firstDetectedAt: '2026-04-15T00:00:00Z',
        daysSeen: 3,
        emailSent: false,
      }],
    }));
    expect(html).toContain('<div class="alert medium">');
    expect(html).toContain('⚠️');
    expect(html).toContain('Seen for 3 days');
    expect(html).not.toContain('Email sent.');
  });
});

describe('renderWidget — KPIs', () => {
  it('renders tiles with up-delta class when applicable', () => {
    const html = renderWidget(baseVm({
      kpis: [
        { label: 'Indexed pages', value: '20', sub: '+2 vs 28d ago', deltaClass: 'up' },
        { label: 'Clicks (28d)', value: '100', sub: 'no change', deltaClass: 'flat' },
      ],
    }));
    expect(html).toContain('class="sub delta up"');
    expect(html).toContain('>+2 vs 28d ago<');
    // Flat tiles: just 'sub' with no delta class
    expect(html).toMatch(/class="sub"[^>]*>no change</);
  });
});

describe('renderWidget — top queries', () => {
  it('renders the queries section when queries are present', () => {
    const html = renderWidget(baseVm({
      topQueries: [
        { query: 'magnus hultberg', clicks: 145, impressions: 3204, ctrPct: '4.5%', position: '2.1' },
      ],
    }));
    expect(html).toContain('Top queries · last 28 days');
    expect(html).toContain('magnus hultberg');
    expect(html).toContain('>145<'); // clicks
    expect(html).toContain('3,204 impr');
    expect(html).toContain('4.5% CTR');
    expect(html).toContain('pos 2.1');
  });

  it('omits the queries section when empty', () => {
    const html = renderWidget(baseVm({ topQueries: [] }));
    expect(html).not.toContain('Top queries');
  });
});

describe('renderWidget — caveat', () => {
  it('renders the caveat line when set', () => {
    const html = renderWidget(baseVm({ caveat: 'Manual refresh — alerts emailed at next 08:00 UTC cron.' }));
    expect(html).toContain('class="widget-caveat"');
    expect(html).toContain('Manual refresh — alerts emailed at next 08:00 UTC cron.');
  });

  it('omits the caveat div when not set', () => {
    const html = renderWidget(baseVm({}));
    expect(html).not.toContain('widget-caveat');
  });
});

describe('renderWidget — footer', () => {
  it('renders the email delivery label with the kind as a class', () => {
    const html = renderWidget(baseVm({
      emailDelivery: { label: 'CF · 2h ago', kind: 'ok' },
    }));
    expect(html).toContain('class="email-delivery ok"');
    expect(html).toContain('Email delivery: CF · 2h ago');
  });

  it('renders the manual-check link with its id attached for wiring', () => {
    const html = renderWidget(baseVm({
      manualCheckRecency: { label: 'Last checked in GSC UI: 3 days ago', neverClicked: false },
    }));
    expect(html).toContain('id="gsc-manual-check-link"');
    expect(html).toContain('Last checked in GSC UI: 3 days ago');
  });
});

describe('renderWidget — escaping (XSS defence)', () => {
  it('escapes HTML in the alert subject and message', () => {
    const html = renderWidget(baseVm({
      alerts: [{
        type: 'indexed-drop', severity: 'high',
        subject: '<script>alert("xss")</script>',
        message: '<img src=x onerror=1>',
        firstDetectedAt: '2026-04-18T00:00:00Z',
        daysSeen: 1,
        emailSent: false,
      }],
    }));
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
  });

  it('escapes HTML in top query text', () => {
    const html = renderWidget(baseVm({
      topQueries: [
        { query: '<b>bold</b>', clicks: 1, impressions: 1, ctrPct: '1%', position: '1' },
      ],
    }));
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('escapes HTML in the caveat text', () => {
    const html = renderWidget(baseVm({ caveat: '<script>x</script>' }));
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  it('escapes HTML in the manual-check recency label', () => {
    const html = renderWidget(baseVm({
      manualCheckRecency: { label: '<evil>', neverClicked: false },
    }));
    expect(html).not.toContain('<evil>');
    expect(html).toContain('&lt;evil&gt;');
  });

  it('escapes HTML in the email delivery label', () => {
    const html = renderWidget(baseVm({
      emailDelivery: { label: '<x>', kind: 'ok' },
    }));
    expect(html).not.toContain('<x>');
    expect(html).toContain('&lt;x&gt;');
  });
});
