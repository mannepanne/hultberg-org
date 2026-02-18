// ABOUT: Route handler for the admin update editor
// ABOUT: GET /admin/updates/new (create) and /admin/updates/:slug/edit (edit)

import type { Env } from '@/types';
import type { Update } from '@/types';
import { requireAuth } from '@/auth';
import { fetchUpdateBySlug, fetchImages } from '@/github';
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

interface ImageEntry {
  name: string;
  path: string;
}

function renderImageGallery(images: ImageEntry[], slug: string): string {
  if (images.length === 0) {
    return '<p style="color:#6c757d;font-size:0.9em">No images yet.</p>';
  }
  return images.map(img => `
    <div class="img-thumb" id="img-${escapeHtml(img.name)}">
      <img src="${escapeHtml(img.path)}" alt="${escapeHtml(img.name)}" loading="lazy" />
      <div class="img-actions">
        <button type="button" onclick="insertImage('${escapeHtml(img.path)}','${escapeHtml(img.name.replace(/\.[^.]+$/, ''))}')" title="Insert at cursor">Insert</button>
        <button type="button" class="del" onclick="deleteImage('${escapeHtml(slug)}','${escapeHtml(img.name)}')" title="Delete image">✕</button>
      </div>
    </div>`).join('');
}

function renderEditor(email: string, update: Partial<Update> | null, images: ImageEntry[], isNew: boolean): string {
  const slug = update?.slug ?? '';
  const title = update?.title ?? '';
  const excerpt = update?.excerpt ?? '';
  const content = update?.content ?? '';
  const status = update?.status ?? 'draft';

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${isNew ? 'New Update' : `Edit: ${escapeHtml(title)}`} - hultberg.org admin</title>
  <link rel="stylesheet" href="${CDN}/easymde.min.css" />
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
    input[type=text], textarea, select {
      width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px;
      font-size: 0.95em; font-family: inherit; background: #fff;
    }
    input[type=text]:focus, textarea:focus, select:focus { outline: none; border-color: #212529; }
    .slug-display { font-size: 0.8em; color: #6c757d; margin-top: 4px; font-family: monospace; }
    .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 24px; }
    .btn { padding: 9px 20px; border-radius: 4px; font-size: 0.9em; cursor: pointer; border: none; font-family: inherit; }
    .btn-primary { background: #212529; color: #fff; }
    .btn-primary:hover { background: #343a40; }
    .btn-secondary { background: #fff; color: #212529; border: 1px solid #ced4da; }
    .btn-secondary:hover { background: #f1f3f5; }
    .status-msg { font-size: 0.85em; padding: 6px 12px; border-radius: 4px; display: none; }
    .status-msg.success { display: inline-block; background: #d4edda; color: #155724; }
    .status-msg.error { display: inline-block; background: #f8d7da; color: #721c24; }
    .images-section { margin-top: 32px; border-top: 1px solid #dee2e6; padding-top: 24px; }
    .images-section h2 { font-size: 1em; margin: 0 0 16px; }
    .img-gallery { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
    .img-thumb { position: relative; width: 120px; }
    .img-thumb img { width: 120px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #dee2e6; display: block; }
    .img-actions { display: flex; gap: 4px; margin-top: 4px; }
    .img-actions button { flex: 1; padding: 2px 0; font-size: 0.75em; cursor: pointer; border-radius: 3px; border: 1px solid #ced4da; background: #fff; }
    .img-actions button.del { background: #f8d7da; border-color: #f5c6cb; color: #721c24; flex: 0 0 24px; }
    .upload-btn { margin-top: 12px; }
    .images-disabled { color: #6c757d; font-size: 0.85em; font-style: italic; }
    footer { text-align: center; color: #adb5bd; font-size: 0.8em; padding: 32px 24px; }
    footer a { color: #adb5bd; }
    .EasyMDEContainer { margin-top: 0; }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="/admin/dashboard">hultberg.org admin</a>
    <nav>
      <a href="/admin/dashboard">Dashboard</a>
    </nav>
    <span class="user">${escapeHtml(email)}</span>
    <form method="POST" action="/admin/logout">
      <button type="submit">Logout</button>
    </form>
  </header>

  <main>
    <h1>${isNew ? 'New Update' : 'Edit Update'}</h1>

    <div class="form-group">
      <label for="title">Title *</label>
      <input type="text" id="title" value="${escapeHtml(title)}" placeholder="Update title" required />
    </div>

    <div class="form-group">
      <label for="excerpt">Excerpt <span style="font-weight:400;color:#6c757d">(optional — shown in listings)</span></label>
      <textarea id="excerpt" rows="2" placeholder="Short summary for listings and RSS feed">${escapeHtml(excerpt)}</textarea>
    </div>

    <div class="form-group">
      <label for="content">Content</label>
      <textarea id="content">${escapeHtml(content)}</textarea>
    </div>

    <div class="form-group">
      <label for="status">Status</label>
      <select id="status">
        <option value="draft"${status === 'draft' ? ' selected' : ''}>Draft</option>
        <option value="published"${status === 'published' ? ' selected' : ''}>Published</option>
        <option value="unpublished"${status === 'unpublished' ? ' selected' : ''}>Unpublished</option>
      </select>
    </div>

    <input type="hidden" id="slug-value" value="${escapeHtml(slug)}" />
    ${!isNew ? `<p class="slug-display">Slug: <strong>${escapeHtml(slug)}</strong> &nbsp;·&nbsp; <a href="/updates/${escapeHtml(slug)}" target="_blank">View public page ↗</a> &nbsp;·&nbsp; <a href="/admin/preview/${escapeHtml(slug)}" target="_blank">Preview ↗</a></p>` : ''}

    <div class="toolbar">
      <button class="btn btn-primary" type="button" onclick="saveUpdate()">Save</button>
      ${!isNew ? `<a class="btn btn-secondary" href="/admin/preview/${escapeHtml(slug)}" target="_blank">Preview</a>` : ''}
      <span class="status-msg" id="status-msg"></span>
    </div>

    <div class="images-section">
      <h2>Images</h2>
      ${isNew
        ? '<p class="images-disabled" id="images-disabled-msg">Save the update first to enable image uploads.</p>'
        : `<button class="btn btn-secondary upload-btn" type="button" id="upload-btn" onclick="triggerUpload()">Upload image</button>
           <input type="file" id="file-input" accept="image/*" style="display:none" onchange="handleFileSelected(this)" />
           <div class="img-gallery" id="img-gallery">${renderImageGallery(images, slug)}</div>`
      }
    </div>
  </main>

  <footer>
    <a href="/admin/dashboard">← Back to dashboard</a>
  </footer>

  <script src="${CDN}/easymde.min.js"></script>
  <script>
    var easyMDE = new EasyMDE({
      element: document.getElementById('content'),
      spellChecker: false,
      autosave: { enabled: false },
      toolbar: [
        'bold', 'italic', 'heading', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', '|',
        {
          name: 'upload-image',
          action: function(editor) { triggerUpload(); },
          className: 'fa fa-picture-o',
          title: 'Upload Image',
        },
        '|', 'preview', 'side-by-side', 'fullscreen', '|', 'guide'
      ],
    });

    // Make toolbar upload button work even before the update is saved
    function triggerUpload() {
      var slug = document.getElementById('slug-value').value;
      if (!slug) {
        showMessage('Save the update first before uploading images.', 'error');
        return;
      }
      document.getElementById('file-input').click();
    }

    async function resizeImage(file) {
      return new Promise(function(resolve) {
        var img = new Image();
        img.onload = function() {
          var w = img.width, h = img.height;
          var max = 800;
          if (w > max || h > max) {
            var ratio = Math.min(max / w, max / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(function(blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.85);
        };
        img.onerror = function() { resolve(file); };
        img.src = URL.createObjectURL(file);
      });
    }

    async function handleFileSelected(input) {
      var file = input.files[0];
      if (!file) return;
      input.value = '';

      var slug = document.getElementById('slug-value').value;
      showMessage('Uploading…', 'success');

      try {
        var resized = await resizeImage(file);
        var formData = new FormData();
        formData.append('slug', slug);
        formData.append('image', resized, resized.name);

        var response = await fetch('/admin/api/upload-image', { method: 'POST', body: formData });
        var data = await response.json();

        if (data.success) {
          showMessage('Image uploaded.', 'success');
          addImageToGallery(data.path, resized.name);
          var altText = resized.name.replace(/\\.[^.]+$/, '');
          var cm = easyMDE.codemirror;
          var cursor = cm.getCursor();
          cm.replaceRange('![' + altText + '](' + data.path + ')', cursor);
        } else {
          showMessage('Upload failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (e) {
        showMessage('Upload failed: network error', 'error');
      }
    }

    function addImageToGallery(path, name) {
      var gallery = document.getElementById('img-gallery');
      if (!gallery) return;
      var slug = document.getElementById('slug-value').value;
      var filename = name.replace(/.*\//, '');
      var altText = filename.replace(/\.[^.]+$/, '');

      var img = document.createElement('img');
      img.src = path;
      img.alt = filename;
      img.loading = 'lazy';

      var insertBtn = document.createElement('button');
      insertBtn.type = 'button';
      insertBtn.textContent = 'Insert';
      insertBtn.addEventListener('click', function() { insertImage(path, altText); });

      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'del';
      deleteBtn.textContent = '\u2715';
      deleteBtn.addEventListener('click', function() { deleteImage(slug, filename); });

      var actions = document.createElement('div');
      actions.className = 'img-actions';
      actions.appendChild(insertBtn);
      actions.appendChild(deleteBtn);

      var div = document.createElement('div');
      div.className = 'img-thumb';
      div.id = 'img-' + filename;
      div.appendChild(img);
      div.appendChild(actions);
      gallery.appendChild(div);
    }

    function insertImage(path, alt) {
      var cm = easyMDE.codemirror;
      cm.replaceRange('![' + alt + '](' + path + ')', cm.getCursor());
      cm.focus();
    }

    async function deleteImage(slug, filename) {
      if (!confirm('Delete image "' + filename + '"?')) return;
      try {
        var response = await fetch('/admin/api/delete-image', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slug, filename: filename })
        });
        var data = await response.json();
        if (data.success) {
          var el = document.getElementById('img-' + filename);
          if (el) el.remove();
          showMessage('Image deleted.', 'success');
        } else {
          showMessage('Delete failed: ' + (data.error || 'Unknown error'), 'error');
        }
      } catch (e) {
        showMessage('Delete failed: network error', 'error');
      }
    }

    async function saveUpdate() {
      var title = document.getElementById('title').value.trim();
      if (!title) { showMessage('Title is required.', 'error'); return; }

      var payload = {
        slug: document.getElementById('slug-value').value || null,
        title: title,
        excerpt: document.getElementById('excerpt').value.trim(),
        content: easyMDE.value(),
        status: document.getElementById('status').value,
      };

      showMessage('Saving…', 'success');

      try {
        var response = await fetch('/admin/api/save-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var data = await response.json();

        if (data.success) {
          if (data.isNew) {
            document.getElementById('slug-value').value = data.slug;
            history.replaceState(null, '', '/admin/updates/' + data.slug + '/edit');
            document.title = 'Edit: ' + title + ' - hultberg.org admin';
            // Enable image uploads now that the slug exists
            var disabledMsg = document.getElementById('images-disabled-msg');
            if (disabledMsg) {
              disabledMsg.outerHTML =
                '<button class="btn btn-secondary upload-btn" type="button" id="upload-btn" onclick="triggerUpload()">Upload image</button>' +
                '<input type="file" id="file-input" accept="image/*" style="display:none" onchange="handleFileSelected(this)" />' +
                '<div class="img-gallery" id="img-gallery"></div>';
            }
          }
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
  </script>
</body>
</html>`;
}

/**
 * Handle GET /admin/updates/new
 * Renders an empty editor form for creating a new update
 */
export async function handleNewUpdate(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  return new Response(renderEditor(authResult, null, [], true), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
  });
}

/**
 * Handle GET /admin/updates/:slug/edit
 * Fetches the existing update and its images, then renders a pre-filled editor
 */
export async function handleEditUpdate(request: Request, env: Env, slug: string): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  const [update, imageFiles] = await Promise.all([
    fetchUpdateBySlug(env, slug),
    fetchImages(env, slug),
  ]);

  if (!update) {
    return Response.redirect(new URL('/admin/dashboard', request.url).toString(), 302);
  }

  const images: ImageEntry[] = imageFiles.map(f => ({
    name: f.name,
    path: `/images/updates/${slug}/${f.name}`,
  }));

  return new Response(renderEditor(authResult, update, images, false), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
  });
}
