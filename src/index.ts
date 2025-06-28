// ABOUT: The main entry point for the Cloudflare Worker.
// ABOUT: This file handles all incoming requests and routes them accordingly.

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // This is the logic for dynamic requests, not static assets.
    // If a request doesn't match a static asset, it will fall through to this.
    return new Response("Dynamic request not found", { status: 404 });
  },
};
