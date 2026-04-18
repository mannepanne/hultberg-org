// ABOUT: Stub for the Workers-runtime-only `cloudflare:email` module.
// ABOUT: Wired in via vitest.config.ts resolve alias so tests can import
// ABOUT: the notifier without exploding on module resolution.

export class EmailMessage {
  constructor(
    public readonly from: string,
    public readonly to: string,
    public readonly raw: string,
  ) {}
}
