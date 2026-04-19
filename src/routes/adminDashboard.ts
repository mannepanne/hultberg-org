// ABOUT: Route handler for /admin/dashboard
// ABOUT: Admin interface listing all updates with edit and delete actions

import type { Env } from '@/types';
import type { Update } from '@/types';
import { requireAuth } from '@/auth';
import { fetchAllUpdates } from '@/github';

const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self';";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  <link rel="stylesheet" href="/admin/dashboard.css" />
</head>
<body>
  <header>
    <a class="brand" href="/admin/dashboard">hultberg.org admin</a>
    <nav>
      <a href="/admin/dashboard" aria-current="page">Dashboard</a>
      <a href="/admin/now/edit">Now</a>
    </nav>
    <span class="user">${email}</span>
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
