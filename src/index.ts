import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// ABOUT: The main entry point for the Cloudflare Worker.
// ABOUT: This file handles all incoming requests and routes them accordingly.

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    try {
      // Try to serve the requested asset first
      return await getAssetFromKV(
        {
          request,
          waitUntil: (promise) => ctx.waitUntil(promise),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
        }
      );
    } catch (e) {
      // If the asset is not found, serve the custom 404 page
      try {
        const notFoundResponse = await getAssetFromKV(
          {
            request: new Request(`${new URL(request.url).origin}/errors/not_found.html`, request),
            waitUntil: (promise) => ctx.waitUntil(promise),
          },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
          }
        );
        return new Response(notFoundResponse.body, {
          status: 404,
          headers: notFoundResponse.headers,
        });
      } catch (e404) {
        // Fallback if even the 404 page isn't found
        return new Response("Custom 404 page not found.", { status: 500 });
      }
    }
  },
};