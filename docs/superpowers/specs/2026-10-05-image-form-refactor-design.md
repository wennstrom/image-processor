# Image form refactor — design

Date: 2026-10-05
Status: draft, awaiting review

## Goal

Make `src/components/image-form.tsx` easy to read and change. Today it is a
565-line file mixing form wiring, aspect-ratio logic, a dropzone, five
presentational inputs, and browser utilities. State for the selected image has
two owners, the aspect-ratio rule is written in three places, validation is
declared twice, and the submit request has no visible lifecycle.

After this change:

- every piece of state has exactly one owner,
- the aspect-ratio rule is one pure, tested function,
- validation is declared once, in the schema,
- the request lifecycle (pending, failed) is visible to the user,
- the form component is wiring and layout only (target ≤ 100 lines).

The bytes sent to the server and the image that comes back are unchanged.

## Non-goals

- **Wiring `sepia`, `sharpen`, `vintage`.** The server (`processImage`) has no
  support for them. They stay in the schema, defaults and UI exactly as today
  and continue not to be sent. Any change to them is a separate spec.
- Adding `@tanstack/react-query` or adopting `createFormHook` / `withForm`.
- Rendering an image thumbnail inside the dropzone.
- Any change to `src/server/`, `src/lib/image/image-request.ts`,
  `src/lib/image/encode-image.ts`, or `src/components/image-context.tsx`.
- Visual redesign. The rendered UI should look the same.

## Decisions

| Decision | Choice | Rejected alternative |
|---|---|---|
| Owner of the selected image | `ImageContext`. The form has no `image` field. | Form owns it, syncs to context on every change. |
| Aspect-ratio model | Explicit `lockedRatio` form field; one pure module in `lib`. | Field `listeners.onChange` with the ratio in a ref. |
| Submission lifecycle | `form.Subscribe` on `isSubmitting` plus a `submitError` in the hook. No new dependency. | `useMutation` from TanStack Query. |
| Field component contract | Leaf components receive the TanStack `field` object (`AnyFieldApi`) as a prop. | `createFormHook` with registered `fieldComponents`. |
| Validation placement | Form-level `onChange: imageFormSchema`, `onSubmit: imageFormSubmitSchema`. No per-field validators. | Keep per-field validators. |
| Unsupported effects | Left as-is, out of scope. | Delete or wire them. |

## File layout

```
src/components/image-form/
  index.tsx                 ImageJobForm — layout and wiring only
  use-image-job-form.ts     useImageJobForm — form config, image acceptance, submit
  image-dropzone.tsx        ImageDropzone (moved, trimmed)
  fields.tsx                DimensionField, PercentSliderField, CheckboxField, ResolutionField
  form-actions.tsx          FormActions — Process + Download buttons, submit error

src/lib/image/aspect-ratio.ts          pure dimension/ratio rules
src/lib/image/aspect-ratio.test.ts
src/lib/image/read-image-size.ts       readImageSize(file) via createImageBitmap
src/lib/image/process-image-job.ts     processImageJob(image, values) → File
src/lib/image/process-image-job.test.ts
src/lib/form/first-error.ts            firstError (moved)
src/lib/download-file.ts               downloadFile (moved)
```

`src/components/image-form.tsx` is deleted. The import
`@/components/image-form` in `src/routes/index.tsx` resolves to the new
`index.tsx`, so the route import does not change.

## Schema changes — `src/lib/validation/image-form.ts`

- Remove `image` from `imageFormSchema`. Keep `imageFileSchema` exported; it is
  now used by the dropzone acceptance path.
- Add `lockedRatio: z.number().positive().nullable()`.
- Export `imageTypes` (currently private) so the dropzone's `accept` attribute
  derives from it.
- Add and export:
  - `defaultImageFormValues: ImageFormValues` (moved from the component;
    `image` removed, `lockedRatio: null` added).
  - `adjustments` — `[{ name: "brightness", label: "Brightness" }, …contrast,
    …saturation]`, typed like `effects`.
  - `effects` — moved from the component unchanged.
  - `type ImageFormSubmitValues = z.infer<typeof imageFormSubmitSchema>`.

`imageFormSubmitSchema` continues to extend the form schema with non-null
`width` and `height`. It no longer mentions `image`.

## Pure logic — `src/lib/image/aspect-ratio.ts`

No React, no form API. Operates on a plain state object and returns a new one.

```ts
export type DimensionState = {
  width: number | null
  height: number | null
  keepRatio: boolean
  lockedRatio: number | null
}

export function ratioOf(width: number | null, height: number | null): number | null
export function changeDimension(state: DimensionState, side: "width" | "height", value: number | null): DimensionState
export function setKeepRatio(state: DimensionState, keepRatio: boolean): DimensionState
export function applySourceSize(state: DimensionState, size: { width: number; height: number }): DimensionState
```

Rules (these preserve today's observable behaviour):

- `ratioOf` returns `width / height` when both are numbers ≥ 1, otherwise `null`.
- `changeDimension` sets `side` to `value`. Then:
  - if `keepRatio` is false, or `value` is `null` or < 1: return with
    `lockedRatio` unchanged and the other side untouched;
  - else if `lockedRatio` is `null`: set `lockedRatio = ratioOf(new width, new
    height)` (may still be `null`) and leave the other side untouched — this is
    today's lazy lock on first edit;
  - else: other side = `max(1, round(value / lockedRatio))` when `side` is
    `"width"`, `max(1, round(value * lockedRatio))` when `"height"`.
- `setKeepRatio(state, true)` sets `lockedRatio = ratioOf(width, height)`.
  `setKeepRatio(state, false)` sets `lockedRatio = null`. (Today the ref is left
  stale on toggle-off and recomputed on toggle-on; clearing it is not
  observable but makes the field's name honest.)
- `applySourceSize` returns `state` unchanged if either size is < 1. Otherwise
  sets `width`, `height` to the size and `lockedRatio = width / height`,
  regardless of `keepRatio` (matches today: the ref is seeded on load).

## Browser helpers

- `src/lib/image/read-image-size.ts` —
  `readImageSize(file: File): Promise<{ width: number; height: number } | null>`.
  Uses `createImageBitmap`, closes the bitmap, returns `null` on any failure.
- `src/lib/download-file.ts` — `downloadFile(file: File): void`, moved verbatim.
- `src/lib/form/first-error.ts` —
  `firstError(errors: ReadonlyArray<unknown>): string | undefined`, moved verbatim.

## Request — `src/lib/image/process-image-job.ts`

```ts
export async function processImageJob(image: File, values: ImageFormSubmitValues): Promise<File>
export function fileFromResponse(response: Response, bytes: ArrayBuffer, source: File): File
```

`processImageJob` builds the body with the existing `imageProcessFormData`
(passing `resolution`, `width`, `height`, `brightness`, `contrast`,
`saturation`, `grayscale`), calls `processImageFn`, reads the body, and returns
`fileFromResponse(...)`. `fileFromResponse` names the file after the source
and uses the response `content-type`, falling back to the source type — the
same conversion that lives inline in `onSubmit` today. Errors propagate to the
caller.

## Hook — `src/components/image-form/use-image-job-form.ts`

```ts
export function useImageJobForm(): {
  form: ReturnType<typeof useForm>   // inferred from useForm, not annotated by hand
  image: File | null
  imageError: string | null
  submitError: string | null
  acceptImage: (file: File | null) => void
  changeDimension: (side: "width" | "height", value: number | null) => void
  toggleKeepRatio: (checked: boolean) => void
}
```

Owns: the `useForm` instance, `imageError`, `submitError`, and a
`latestAccepted: useRef<File | null>` used only as a race guard for
`readImageSize`.

The hook imports the pure module as a namespace
(`import * as ratio from "@/lib/image/aspect-ratio"`) so that the hook's
`changeDimension`/`toggleKeepRatio` and the pure `ratio.changeDimension`/
`ratio.setKeepRatio` are never confused in the code below.

Reads `image`, `setImage`, `setProcessedImage` from `useImageContext()`.

**`useForm` config**

- `defaultValues: defaultImageFormValues`
- `validators: { onChange: imageFormSchema, onSubmit: imageFormSubmitSchema }`
- `onSubmit`: see below.

**`acceptImage(file)`** — the single place where "an image was chosen or
removed" is defined.

1. `setSubmitError(null)`.
2. If `file` is `null`: `setImage(null)`, `setProcessedImage(null)`,
   `setImageError(null)`, `latestAccepted.current = null`. Width/height are
   left as the user set them. Return.
3. `imageFileSchema.safeParse(file)`. On failure: `setImageError(message)` and
   return without touching context.
4. On success: `setImageError(null)`, `setImage(file)`,
   `setProcessedImage(null)`, `latestAccepted.current = file`.
5. `await readImageSize(file)`. If the result is `null` or
   `latestAccepted.current !== file`, stop. Otherwise compute
   `applySourceSize(currentDimensionState, size)` and write `width`, `height`,
   `lockedRatio` to the form.

**`changeDimension(side, value)`** — compute
`changeDimension(currentDimensionState, side, value)` from the pure module and
write `width`, `height`, `lockedRatio` to the form with `form.setFieldValue`.

**`toggleKeepRatio(checked)`** — write `keepRatio = checked`, then compute
`setKeepRatio(...)` and write `lockedRatio`.

`currentDimensionState` is read from `form.state.values` at call time.

**`onSubmit({ value })`**

1. If `image` is `null`: `setSubmitError("Upload an image")` and return. (The
   Process button is also disabled in this case; the check is defensive.)
2. `const values = imageFormSubmitSchema.parse(value)` — narrows `width` and
   `height` to `number`. This cannot throw in practice because the same schema
   is the `onSubmit` validator; it replaces today's unreachable early return.
3. `setSubmitError(null)`, then `setProcessedImage(await processImageJob(image, values))`.
4. On throw: `setSubmitError(message from the error, or "Image processing failed")`.

## Components

### `index.tsx` — `ImageJobForm({ className?: string })`

Calls `useImageJobForm()`. Renders:

```
Card (size="sm", className=cn("h-full min-h-0", className))
  CardHeader > CardTitle "Processing Options"
  <form onSubmit={preventDefault; stopPropagation; void form.handleSubmit()}>
    CardContent (scrollable)
      ImageDropzone  file={image} error={imageError} inputId="image" onFile={acceptImage}
      fieldset
        grid 2 cols
          form.Field "width"  → DimensionField field label="Width (px)"  onChange={v => changeDimension("width", v)}
          form.Field "height" → DimensionField field label="Height (px)" onChange={v => changeDimension("height", v)}
        form.Field "keepRatio" → CheckboxField field label="Keep ratio" onChange={toggleKeepRatio}
      form.Field "resolution" → ResolutionField field
      adjustments.map → form.Field name → PercentSliderField field label
      grid 2 cols: effects.map → form.Field name → CheckboxField field label
    CardFooter
      form.Subscribe selector={s => s.isSubmitting}
        → FormActions pending canSubmit={image !== null} submitError
```

The `w-1/4` class is removed from the component; `src/routes/index.tsx` passes
`className="w-1/4"`.

### `fields.tsx`

All take `field: AnyFieldApi` (exported by `@tanstack/react-form`) and derive
`id`/`name` from `field.name`, value from `field.state.value`, blur from
`field.handleBlur`, and error text via `firstError(field.state.meta.errors)`.

- `DimensionField({ field, label, onChange })` — numeric `Input`, `min=1`,
  `step=1`, parses with a private `parseDimension` (moved verbatim). `onChange`
  is required because dimension edits go through the hook, not
  `field.handleChange`.
- `PercentSliderField({ field, label })` — range 0–200, shows `value%`, uses
  `field.handleChange`.
- `CheckboxField({ field, label, onChange? })` — the checkbox+label markup
  that appears twice today. `onChange` defaults to `field.handleChange`.
- `ResolutionField({ field })` — fieldset with legend "Resolution" and one
  toggle `Button` per entry in `resolutions`, `aria-pressed` on the selected
  one. Replaces `OptionGroup` + `Choice`, which had a single call site.

### `image-dropzone.tsx` — `ImageDropzone({ file, error, inputId, onFile })`

Moved from the current file with three edits: the `takeFile` pass-through is
removed (call `onFile` directly), `useObjectUrl`/`previewUrl` are removed (the
URL was only used as a boolean), and `accept` is `imageTypes.join(",")`.

### `form-actions.tsx` — `FormActions({ pending, canSubmit, submitError })`

- Process button: `type="submit"`, `disabled={pending || !canSubmit}`, label
  "Processing…" while pending, otherwise "Process image".
- Download button: reads `image`, `processedImage` from context; downloads
  `processedImage ?? image`; disabled when both are `null`.
- Renders `submitError` as `text-xs text-destructive` when present.

## Data flow

```
user drops/picks file
  → ImageDropzone.onFile
  → hook.acceptImage
      ├─ imageFileSchema  ──✗──► imageError (dropzone shows it)
      └─ ✓ context.setImage, context.setProcessedImage(null)
           └─ readImageSize ──► applySourceSize ──► form width/height/lockedRatio

user edits width/height
  → DimensionField.onChange → hook.changeDimension → aspect-ratio.changeDimension → form

user toggles Keep ratio
  → CheckboxField.onChange → hook.toggleKeepRatio → aspect-ratio.setKeepRatio → form

user clicks Process
  → form.handleSubmit → onSubmit validator (imageFormSubmitSchema)
  → hook.onSubmit → processImageJob(image, values) → context.setProcessedImage
                                                   └─✗──► submitError (FormActions shows it)
```

Context is the only owner of `image` and `processedImage`. The form is the
only owner of every numeric/boolean option. The hook is the only place that
writes to either.

## Behaviour changes

All intentional; everything else is behaviour-preserving.

1. Removing the image now clears the preview and any processed output. Today
   the form field clears but context keeps the old file.
2. Choosing a new image clears the previous processed output, so the preview
   never shows a result from a different source.
3. A dropped file with an unsupported type is rejected with an error message
   and does not reach context. Today it reaches the preview despite the error.
4. The Process button is disabled when there is no image and while a request
   is in flight; a failed request shows a message. Today a failure is silent
   and the button is always enabled.

Not a behaviour change: the request body, server, and output image are
identical; the layout is identical (width now set by the parent).

## Error handling

- Invalid file type → `imageError`, shown under the dropzone.
- Invalid width/height → field errors from the form-level schema, shown under
  the input (as today).
- `readImageSize` failure → silently leave dimensions as the user set them (as
  today).
- `processImageJob` failure → `submitError`, shown in the footer; form stays
  populated for retry.

## Testing

Runner: `vitest` (`npm test`). Follow the style of
`src/lib/image/image-request.test.ts`.

**`aspect-ratio.test.ts`**

- `ratioOf`: both valid → ratio; either `null` or < 1 → `null`.
- `changeDimension` with `keepRatio: false` → only the changed side moves,
  `lockedRatio` unchanged.
- `changeDimension` with `keepRatio: true`, `lockedRatio: null`, other side
  valid → locks the ratio, other side unchanged (lazy lock).
- `changeDimension` with `keepRatio: true`, `lockedRatio: null`, other side
  `null` → no lock, no change to other side.
- `changeDimension` with a locked ratio → other side follows, rounded, never
  below 1 (test a case that would round to 0).
- `changeDimension` to `null` or `0` → other side and ratio untouched.
- `setKeepRatio(true)` locks from current dims; `setKeepRatio(false)` clears.
- `applySourceSize` with valid size sets all three; with a 0 dimension returns
  input unchanged.

**`process-image-job.test.ts`**

- `fileFromResponse` uses the source name, prefers the response
  `content-type`, falls back to the source type when the header is missing.

**Existing tests** (`image-request.test.ts`, `encode-image.test.ts`,
`image-job.test.ts`) must keep passing unchanged.

**Static checks**: `npm run typecheck`, `npm run lint`, `npm run check`.

**Manual check** (`npm run dev`):

1. Drop a PNG → width/height populate, preview shows it.
2. Edit width with Keep ratio on → height follows; toggle off → independent;
   toggle on → ratio re-locks from current values.
3. Click Remove → preview empties, Download disabled.
4. Drop a `.txt` → error under dropzone, preview unchanged.
5. Process → button reads "Processing…" and is disabled; result appears;
   Download gives the processed file.
6. Process with the dev server stopped → error message in footer, form intact.

## Implementation order

Each step leaves the app working and the tests green.

1. Pure moves, no behaviour change: `firstError`, `downloadFile` to `lib`;
   `ImageDropzone` and the field primitives to the new folder; `effects`,
   `defaultValues` to the schema file; delete `useObjectUrl`. Convert the
   component file into `image-form/index.tsx`.
2. `aspect-ratio.ts` with tests; `read-image-size.ts`; replace the ref-based
   logic in the component with calls to the pure module.
3. Schema: drop `image`, add `lockedRatio`, export `imageTypes`,
   `adjustments`, `ImageFormSubmitValues`. Move image ownership to context via
   `acceptImage`. Form-level validators replace per-field ones.
4. `process-image-job.ts` with test; `FormActions` with `form.Subscribe`,
   `submitError`.
5. Extract `use-image-job-form.ts`; collapse `index.tsx` to wiring; move
   `w-1/4` to the route.

## Follow-ups noticed, not in scope

- `src/components/image-preview.tsx` calls `URL.createObjectURL` on every
  render and never revokes. The `useObjectUrl` hook being deleted here is the
  right shape for fixing that.
- `useImageContext` falls back to no-op setters when no provider is mounted,
  which hides a missing `ImageProvider` instead of failing loudly.
- The `sepia`/`sharpen`/`vintage` toggles are visible to users but have no
  effect. Either wire them (server work) or remove them.
