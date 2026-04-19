// ABOUT: Route handler for /admin/dashboard
// ABOUT: Admin interface listing all updates with edit and delete actions

import type { Env } from '@/types';
import type { Update } from '@/types';
import { requireAuth } from '@/auth';
import { fetchAllUpdates } from '@/github';
import { escapeHtml } from '@/utils';

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self';";

function formatDate(isoDate: string): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function statusBadge(status: string): string {
  const colours: Record<string, string> = {
    published: 'background:#d4edda;color:#155724',
    draft: 'background:#fff3cd;color:#856404',
    unpublished: 'background:#f8d7da;color:#721c24',
  };
  const style = colours[status] ?? 'background:#e2e3e5;color:#383d41';
  return `<span style="padding:2px 8px;border-radius:12px;font-size:0.8em;font-weight:600;${style}">${status}</span>`;
}

function updateRow(update: Update): string {
  return `
    <tr id="row-${update.slug}">
      <td><a href="/updates/${update.slug}" target="_blank">${escapeHtml(update.title)}</a></td>
      <td>${statusBadge(update.status)}</td>
      <td>${formatDate(update.publishedDate)}</td>
      <td>${formatDate(update.editedDate)}</td>
      <td style="white-space:nowrap">
        <a href="/admin/updates/${update.slug}/edit" style="margin-right:8px">Edit</a>
        <button
          data-slug="${update.slug}"
          data-title="${escapeHtml(update.title)}"
          onclick="confirmDelete(this.dataset.slug, this.dataset.title)"
          style="background:none;border:none;color:#dc3545;cursor:pointer;padding:0;font-size:inherit">
          Delete
        </button>
      </td>
    </tr>`.trim();
}

function renderDashboard(email: string, updates: Update[]): string {
  const rows = updates.length > 0
    ? updates.map(updateRow).join('\n')
    : `<tr><td colspan="5" style="text-align:center;color:#6c757d;padding:32px">No updates yet. <a href="/admin/updates/new">Create your first update</a>.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Admin Dashboard - hultberg.org</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #333;
      margin: 0;
      background: #f8f9fa;
    }
    header {
      background: #212529;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    header .brand { font-weight: 700; font-size: 1.1em; flex: 1; color: #fff; text-decoration: none; }
    header nav a { color: #adb5bd; text-decoration: none; margin-right: 16px; }
    header nav a:hover { color: #fff; }
    header .user { color: #adb5bd; font-size: 0.85em; margin-right: 12px; }
    header form { margin: 0; }
    header button {
      background: transparent;
      border: 1px solid #6c757d;
      color: #adb5bd;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }
    header button:hover { border-color: #adb5bd; color: #fff; }
    main { max-width: 960px; margin: 32px auto; padding: 0 24px; }
    h1 { font-size: 1.4em; margin: 0 0 20px; }
    .actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }
    .btn-primary {
      background: #212529;
      color: #fff;
      padding: 8px 16px;
      border-radius: 4px;
      text-decoration: none;
      font-size: 0.9em;
    }
    .btn-primary:hover { background: #343a40; }
    /* GSC widget */
    .widget { background: #fff; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 24px; overflow: hidden; }
    .widget-header { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #f1f3f5; }
    .widget-header h2 { font-size: 1em; font-weight: 600; margin: 0; flex: 1; color: #212529; }
    .widget-header h2 a { color: #0d6efd; text-decoration: none; }
    .widget-header h2 a:hover { text-decoration: underline; }
    .widget-header .freshness { font-size: 0.8em; color: #6c757d; }
    .widget-header .freshness.stale { color: #dc3545; font-weight: 600; }
    .widget-header button.refresh { background: transparent; border: 1px solid #dee2e6; color: #495057; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em; }
    .widget-header button.refresh:hover:not(:disabled) { border-color: #adb5bd; background: #f8f9fa; }
    .widget-header button.refresh:disabled { opacity: 0.6; cursor: wait; }
    .widget-body { padding: 16px 20px; }
    .widget-body.error { color: #721c24; background: #f8d7da; }
    .alerts { padding: 0 20px; }
    .alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 4px; margin: 12px 0; font-size: 0.88em; }
    .alert .icon { font-size: 1.1em; line-height: 1; }
    .alert .body { flex: 1; }
    .alert .body .title { font-weight: 600; color: #212529; }
    .alert .body .meta { color: #6c757d; font-size: 0.9em; margin-top: 2px; }
    .alert.medium { background: #fff3cd; border-left: 3px solid #ffc107; }
    .alert.high { background: #f8d7da; border-left: 3px solid #dc3545; }
    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px 20px; }
    .tile { background: #f8f9fa; border: 1px solid #f1f3f5; border-radius: 6px; padding: 14px; }
    .tile .label { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; color: #6c757d; margin-bottom: 6px; }
    .tile .value { font-size: 1.6em; font-weight: 700; color: #212529; line-height: 1.1; }
    .tile .sub { font-size: 0.8em; color: #6c757d; margin-top: 4px; }
    .tile .sub.delta.up { color: #155724; }
    .tile .sub.delta.down { color: #721c24; }
    .queries { padding: 4px 20px 16px; }
    .queries h3 { font-size: 0.8em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6c757d; margin: 12px 0 8px; }
    .queries table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    .queries td { padding: 6px 0; border-top: 1px solid #f1f3f5; vertical-align: middle; }
    .queries tr:first-child td { border-top: none; }
    .queries td.query { color: #212529; }
    .queries td.metrics { text-align: right; color: #6c757d; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .queries td.metrics .clicks { font-weight: 600; color: #212529; margin-right: 10px; }
    .gsc-footer { padding: 12px 20px; font-size: 0.82em; color: #6c757d; background: #fafbfc; border-top: 1px solid #f1f3f5; display: flex; gap: 20px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .gsc-footer .email-delivery.ok { color: #155724; }
    .gsc-footer .email-delivery.warn { color: #856404; }
    .gsc-footer .email-delivery.error { color: #721c24; font-weight: 600; }
    .gsc-footer .email-delivery.idle { color: #6c757d; }
    .refresh-error { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #f8d7da; color: #721c24; border-bottom: 1px solid #f5c6cb; font-size: 0.88em; }
    .refresh-error .msg { flex: 1; }
    .refresh-error button.dismiss { background: transparent; border: none; color: #721c24; cursor: pointer; font-size: 1.2em; padding: 0 4px; line-height: 1; }
    .refresh-error button.dismiss:hover { color: #491217; }
    @media (max-width: 720px) { .tiles { grid-template-columns: repeat(2, 1fr); } }

    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
    th { background: #f1f3f5; font-size: 0.8em; text-transform: uppercase; letter-spacing: .05em; color: #6c757d; padding: 10px 14px; text-align: left; }
    td { padding: 12px 14px; border-top: 1px solid #f1f3f5; vertical-align: middle; font-size: 0.9em; }
    tr:hover td { background: #fafafa; }
    a { color: #0d6efd; text-decoration: none; }
    a:hover { text-decoration: underline; }
    footer { text-align: center; color: #adb5bd; font-size: 0.8em; padding: 32px 24px; }
    footer a { color: #adb5bd; }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="/admin/dashboard">hultberg.org admin</a>
    <nav>
      <a href="/admin/dashboard" aria-current="page">Dashboard</a>
      <a href="/admin/now/edit">Now</a>
    </nav>
    <span class="user">${escapeHtml(email)}</span>
    <form method="POST" action="/admin/logout">
      <button type="submit">Logout</button>
    </form>
  </header>

  <main>
    <div id="gsc-widget-root"></div>

    <div class="actions">
      <a class="btn-primary" href="/admin/updates/new">+ New Update</a>
    </div>

    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Status</th>
          <th>Published</th>
          <th>Last edited</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </main>

  <footer>
    <a href="https://github.com/mannepanne/hultberg-org/actions" target="_blank">Deploy status: GitHub Actions</a>
    &nbsp;·&nbsp;
    <a href="/">View site</a>
  </footer>

  <script>
    function confirmDelete(slug, title) {
      if (!confirm('Delete "' + title + '"?\\n\\nThis cannot be undone.')) return;
      fetch('/admin/api/delete-update', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          var row = document.getElementById('row-' + slug);
          if (row) row.remove();
        } else {
          alert('Delete failed: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(function() { alert('Delete failed: network error'); });
    }
  </script>
  <script src="/admin/gsc-widget.js"></script>
</body>
</html>`;
}

/**
 * Handle GET /admin/dashboard
 * Fetches all updates from GitHub and renders the admin dashboard
 */
export async function handleAdminDashboard(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  const email = authResult;
  const updates = await fetchAllUpdates(env);

  return new Response(renderDashboard(email, updates), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP,
    },
  });
}
