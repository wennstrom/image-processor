# Image Processor

TanStack Start skeleton with shadcn/ui, TanStack Form, Zod, and Effect.

## Layers

- `src/lib/validation` — Zod schemas. This is the only place input shape is checked.
- `src/lib/domain` — Effect programs. They accept already-parsed input and fail with tagged errors.
- `src/server` — TanStack Start server functions. They parse with Zod, then run the Effect program.
- `src/components/ui` — shadcn components.

The home page plans an image job with TanStack Form. Zod reports field errors. The server function parses again, then `planImageJob` decides whether the job is allowed.

## Scripts

```bash
bun run dev
bun run test
bun run typecheck
bun run build
```

Add shadcn components with:

```bash
npx shadcn@latest add dialog
```
