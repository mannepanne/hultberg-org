// ABOUT: Route handler for /now page editor
// ABOUT: GET /admin/now/edit - admin interface for editing /now page content

import type { Env, NowContent } from '@/types';
import { requireAuth, checkRateLimit } from '@/auth';
import { escapeHtml } from '@/utils';

const CDN = 'https://cdn.jsdelivr.net/npm/easymde@2.18.0/dist';
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CDN.split('/npm')[0]} https://static.cloudflareinsights.com`,
  `style-src 'self' 'unsafe-inline' ${CDN.split('/npm')[0]}`,
  `font-src ${CDN.split('/npm')[0]}`,
  "img-src 'self' data: blob:",
  "connect-src 'self' https://cloudflareinsights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

function renderEditor(email: string, content: NowContent): string {
  const markdown = content.markdown ?? '';

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Edit /now Page - hultberg.org admin</title>
  <link rel="stylesheet" href="${CDN}/easymde.min.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; margin: 0; background: #f8f9fa; }
    header { background: #212529; color: #fff; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
    header .brand { font-weight: 700; font-size: 1.1em; flex: 1; color: #fff; text-decoration: none; }
    header nav a { color: #adb5bd; text-decoration: none; margin-right: 16px; }
    header nav a:hover { color: #fff; }
    header .user { color: #adb5bd; font-size: 0.85em; margin-right: 12px; }
    header form { margin: 0; }
    header button { background: transparent; border: 1px solid #6c757d; color: #adb5bd; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em; }
    header button:hover { border-color: #adb5bd; color: #fff; }
    main { max-width: 860px; margin: 32px auto; padding: 0 24px; }
    h1 { font-size: 1.3em; margin: 0 0 24px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; font-weight: 600; font-size: 0.85em; margin-bottom: 6px; color: #495057; }
    .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
    .btn { padding: 9px 20px; border-radius: 4px; font-size: 0.9em; cursor: pointer; border: none; font-family: inherit; }
    .btn-primary { background: #212529; color: #fff; }
    .btn-primary:hover { background: #343a40; }
    .btn-secondary { background: #fff; color: #212529; border: 1px solid #ced4da; }
    .btn-secondary:hover { background: #f1f3f5; }
    .status-msg { font-size: 0.85em; padding: 6px 12px; border-radius: 4px; display: none; }
    .status-msg.success { display: inline-block; background: #d4edda; color: #155724; }
    .status-msg.error { display: inline-block; background: #f8d7da; color: #721c24; }
    footer { text-align: center; color: #adb5bd; font-size: 0.8em; padding: 32px 24px; }
    footer a { color: #adb5bd; }
    .EasyMDEContainer { margin-top: 0; }
    .help-text { color: #6c757d; font-size: 0.85em; margin-top: 8px; }
    .snapshots-section { margin-top: 48px; }
    .snapshots-section h2 { font-size: 1.1em; margin-bottom: 16px; }
    .snapshots-table { width: 100%; background: #fff; border-radius: 4px; overflow: hidden; border: 1px solid #dee2e6; }
    .snapshots-table table { width: 100%; border-collapse: collapse; }
    .snapshots-table th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; font-size: 0.85em; color: #495057; border-bottom: 2px solid #dee2e6; }
    .snapshots-table td { padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 0.9em; }
    .snapshots-table tr:last-child td { border-bottom: none; }
    .snapshots-table tr:hover { background: #f8f9fa; }
    .snapshots-table .actions { white-space: nowrap; text-align: right; }
    .snapshots-table .delete-btn { background: none; border: none; color: #dc3545; cursor: pointer; padding: 0; font-size: inherit; }
    .snapshots-table .delete-btn:hover { text-decoration: underline; }
    .snapshots-table .empty { text-align: center; color: #6c757d; padding: 32px; }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="/admin/dashboard">hultberg.org admin</a>
    <nav>
      <a href="/admin/dashboard">Dashboard</a>
      <a href="/admin/now/edit" aria-current="page">Now</a>
    </nav>
    <span class="user">${escapeHtml(email)}</span>
    <form method="POST" action="/admin/logout">
      <button type="submit">Logout</button>
    </form>
  </header>

  <main>
    <h1>Edit /now Page</h1>

    <div class="form-group">
      <label for="content">Content</label>
      <textarea id="content">${escapeHtml(markdown)}</textarea>
      <p class="help-text">
        Write in Markdown. The page layout and widgets (Goodreads, GitHub) remain unchanged.
        <br><a href="/now" target="_blank">View public /now page ↗</a>
      </p>
    </div>

    <div class="toolbar">
      <button class="btn btn-primary" type="button" onclick="saveContent()">Save</button>
      <a class="btn btn-secondary" href="/now" target="_blank">View Page</a>
      <button class="btn btn-secondary" type="button" onclick="archiveSnapshot()">Archive Snapshot</button>
      <span class="status-msg" id="status-msg"></span>
    </div>

    <div class="snapshots-section">
      <h2>Snapshots</h2>
      <div class="snapshots-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Preview</th>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody id="snapshots-list">
            <tr><td colspan="3" class="empty">Loading snapshots...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <footer>
    <a href="/admin/dashboard">← Back to dashboard</a>
  </footer>

  <script src="${CDN}/easymde.min.js" onerror="console.error('Failed to load EasyMDE from CDN')"></script>
  <script>
    console.log('Script starting...');
    console.log('EasyMDE available:', typeof EasyMDE !== 'undefined');

    try {
      var contentElement = document.getElementById('content');
      console.log('Content element:', contentElement);

      if (!contentElement) {
        console.error('Content element not found!');
      } else {
        var easyMDE = new EasyMDE({
          element: contentElement,
          spellChecker: false,
          autosave: { enabled: false },
          toolbar: [
            'bold', 'italic', 'heading', '|',
            'quote', 'unordered-list', 'ordered-list', '|',
            'link', 'code', '|',
            'preview', 'side-by-side', 'fullscreen', '|', 'guide'
          ],
        });
        console.log('EasyMDE initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing EasyMDE:', error);
    }

    async function saveContent() {
      var markdown = easyMDE.value().trim();
      if (!markdown) {
        showMessage('Content cannot be empty.', 'error');
        return;
      }

      var payload = {
        markdown: markdown,
      };

      showMessage('Saving…', 'success');

      try {
        var response = await fetch('/admin/api/save-now', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = await response.json();

        if (data.success) {
          showMessage('Saved!', 'success');
        } else {
          showMessage('Save failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (e) {
        showMessage('Save failed: network error', 'error');
      }
    }

    function showMessage(msg, type) {
      var el = document.getElementById('status-msg');
      el.textContent = msg;
      el.className = 'status-msg ' + type;
      clearTimeout(el._timer);
      el._timer = setTimeout(function() { el.className = 'status-msg'; }, 4000);
    }

    // Snapshot management functions
    async function archiveSnapshot() {
      var markdown = easyMDE.value().trim();
      if (!markdown) {
        showMessage('Content cannot be empty.', 'error');
        return;
      }

      var payload = { markdown: markdown };
      showMessage('Creating snapshot…', 'success');

      try {
        var response = await fetch('/admin/api/create-now-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = await response.json();

        if (data.success) {
          if (data.overwritten) {
            showMessage('Snapshot updated for today!', 'success');
          } else {
            showMessage('Snapshot created!', 'success');
          }
          loadSnapshots();
        } else {
          showMessage('Snapshot failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (e) {
        showMessage('Snapshot failed: network error', 'error');
      }
    }

    async function loadSnapshots() {
      try {
        var response = await fetch('/admin/api/list-now-snapshots');
        var data = await response.json();

        var tbody = document.getElementById('snapshots-list');

        if (!data.snapshots || data.snapshots.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="empty">No snapshots yet. Click "Archive Snapshot" to create one.</td></tr>';
          return;
        }

        tbody.innerHTML = data.snapshots.map(function(snapshot) {
          var formattedDate = formatSnapshotDate(snapshot.date);
          var preview = snapshot.preview.substring(0, 100);
          if (snapshot.preview.length > 100) preview += '...';

          return '<tr>' +
            '<td>' + formattedDate + '</td>' +
            '<td>' + escapeHtmlClient(preview) + '</td>' +
            '<td class="actions">' +
              '<button class="delete-btn" onclick="deleteSnapshot(\'' + snapshot.date + '\', \'' + formattedDate + '\')">Delete</button>' +
            '</td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        console.error('Failed to load snapshots:', e);
      }
    }

    async function deleteSnapshot(date, formattedDate) {
      if (!confirm('Delete snapshot from ' + formattedDate + '?')) {
        return;
      }

      try {
        var response = await fetch('/admin/api/delete-now-snapshot?date=' + date, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        var data = await response.json();

        if (data.success) {
          showMessage('Snapshot deleted!', 'success');
          loadSnapshots();
        } else {
          showMessage('Delete failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (e) {
        showMessage('Delete failed: network error', 'error');
      }
    }

    function formatSnapshotDate(dateStr) {
      // Convert YYYYMMDD to readable format
      var year = dateStr.substring(0, 4);
      var month = dateStr.substring(4, 6);
      var day = dateStr.substring(6, 8);
      var date = new Date(year + '-' + month + '-' + day);
      return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function escapeHtmlClient(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Load snapshots on page load
    try {
      console.log('Loading snapshots...');
      loadSnapshots();
    } catch (error) {
      console.error('Error calling loadSnapshots:', error);
    }
  </script>
</body>
</html>`;
}

/**
 * Handle GET /admin/now/edit
 * Loads /now page content from content.json and renders editor form
 */
export async function handleNowEditor(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  // Rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const rateLimited = await checkRateLimit(env, clientIP);
  if (rateLimited) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  try {
    // Fetch content.json via ASSETS binding
    const url = new URL(request.url);
    const contentUrl = `${url.origin}/now/data/content.json`;
    const contentResponse = await (env.ASSETS?.fetch(new Request(contentUrl)) ?? fetch(contentUrl));

    if (!contentResponse.ok) {
      // If content.json doesn't exist yet, create empty content
      const emptyContent: NowContent = {
        markdown: '',
        lastUpdated: new Date().toISOString(),
      };
      return new Response(renderEditor(authResult, emptyContent), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
      });
    }

    const content: NowContent = await contentResponse.json();

    return new Response(renderEditor(authResult, content), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
    });
  } catch (error) {
    console.error('Error loading /now editor:', error);
    return new Response('Error loading editor', { status: 500 });
  }
}
