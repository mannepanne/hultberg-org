// ABOUT: Route handler for /admin login page
// ABOUT: Displays email input form for magic link authentication

/**
 * Renders the admin login page
 * Simple form with email input and submit button
 */
export function renderAdminLoginPage(error?: string, success?: string): string {
  const errorHtml = error
    ? `<p style="color: #dc3545; background-color: #f8d7da; padding: 12px; border-radius: 4px; margin-bottom: 20px;">${error}</p>`
    : '';

  const successHtml = success
    ? `<p style="color: #155724; background-color: #d4edda; padding: 12px; border-radius: 4px; margin-bottom: 20px;">${success}</p>`
    : '';

  return `
<!DOCTYPE html>
<html class="no-js" lang="en-GB">
    <head>
        <meta charset="utf-8" />
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <title>Admin Login - Magnus Hultberg</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />

        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 500px;
                margin: 80px auto;
                padding: 20px;
            }
            h1 {
                font-size: 2em;
                margin-bottom: 0.5em;
                color: #212529;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #495057;
            }
            input[type="email"] {
                width: 100%;
                padding: 12px;
                font-size: 16px;
                border: 1px solid #ced4da;
                border-radius: 4px;
                box-sizing: border-box;
            }
            input[type="email"]:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
            }
            button {
                background-color: #007bff;
                color: white;
                padding: 12px 30px;
                font-size: 16px;
                font-weight: 600;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                width: 100%;
            }
            button:hover {
                background-color: #0056b3;
            }
            button:disabled {
                background-color: #6c757d;
                cursor: not-allowed;
            }
            .info {
                margin-top: 30px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 4px;
                font-size: 14px;
                color: #6c757d;
            }
        </style>
    </head>
    <body>
        <h1>Admin Login</h1>

        ${errorHtml}
        ${successHtml}

        <form id="loginForm" method="POST" action="/admin/api/send-magic-link">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="your@email.com"
                    autocomplete="email"
                />
            </div>

            <button type="submit" id="submitBtn">Send Login Link</button>
        </form>

        <div class="info">
            <p><strong>How it works:</strong></p>
            <p>Enter your email address and we'll send you a secure login link. The link will expire in 15 minutes and can only be used once.</p>
        </div>

        <script>
            const form = document.getElementById('loginForm');
            const submitBtn = document.getElementById('submitBtn');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';

                const formData = new FormData(form);
                const email = formData.get('email');

                try {
                    const response = await fetch('/admin/api/send-magic-link', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email }),
                    });

                    if (response.ok) {
                        // Show success message
                        window.location.href = '/admin?success=check-email';
                    } else {
                        const data = await response.json();
                        window.location.href = '/admin?error=' + encodeURIComponent(data.error || 'Failed to send login link');
                    }
                } catch (error) {
                    window.location.href = '/admin?error=' + encodeURIComponent('Network error. Please try again.');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Login Link';
                }
            });
        </script>
    </body>
</html>
  `.trim();
}

/**
 * Handle GET /admin
 * Shows login form or redirects to dashboard if already authenticated
 */
export async function handleAdminLogin(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Check for error or success query params
  const error = url.searchParams.get('error');
  const success = url.searchParams.get('success');

  let errorMessage: string | undefined;
  let successMessage: string | undefined;

  if (error === 'rate-limit') {
    errorMessage = 'Too many requests. Please try again in a minute.';
  } else if (error) {
    errorMessage = decodeURIComponent(error);
  }

  if (success === 'check-email') {
    successMessage = 'Check your email! We sent you a login link. It will expire in 15 minutes.';
  }

  const html = renderAdminLoginPage(errorMessage, successMessage);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self';",
    },
  });
}
