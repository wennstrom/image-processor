# Image Form Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 565-line `image-form.tsx` into focused modules so every piece of state has one owner, aspect-ratio logic is one pure tested function, validation lives only in the schema, and submit lifecycle (pending/error) is visible — without changing request bytes or the returned image.

**Architecture:** Pure dimension/ratio rules and request helpers live under `src/lib/`. A `useImageJobForm` hook owns form config, image acceptance, and submit. Leaf field components receive TanStack `field` objects. `ImageContext` is the sole owner of `image` / `processedImage`. The form component is wiring and layout only (target ≤ 100 lines).

**Tech Stack:** React 19, TanStack React Form, Zod 4, Vitest, Vite / TanStack Start. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-05-image-form-refactor-design.md`

## Global Constraints

- Do not change `src/server/`, `src/lib/image/image-request.ts`, `src/lib/image/encode-image.ts`, or `src/components/image-context.tsx`.
- Do not wire `sepia` / `sharpen` / `vintage` to the server; leave schema, defaults, and UI as today.
- Do not add `@tanstack/react-query` or `createFormHook` / `withForm`.
- Do not render a thumbnail inside the dropzone; do not visually redesign.
- Existing tests (`image-request.test.ts`, `encode-image.test.ts`, `image-job.test.ts`) must keep passing unchanged.
- After every task: `npm test`, `npm run typecheck`, and the app still runs.

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/form/first-error.ts` | Extract first string message from TanStack field errors |
| `src/lib/download-file.ts` | Trigger browser download for a `File` |
| `src/lib/image/aspect-ratio.ts` | Pure width/height/keepRatio/lockedRatio rules |
| `src/lib/image/aspect-ratio.test.ts` | Unit tests for aspect-ratio |
| `src/lib/image/read-image-size.ts` | `createImageBitmap` → `{ width, height } \| null` |
| `src/lib/image/process-image-job.ts` | Call `processImageFn`, build result `File` |
| `src/lib/image/process-image-job.test.ts` | Unit tests for `fileFromResponse` |
| `src/lib/validation/image-form.ts` | Schema, defaults, `effects`, `adjustments`, `imageTypes` |
| `src/components/image-form/index.tsx` | `ImageJobForm` — layout + wiring only |
| `src/components/image-form/use-image-job-form.ts` | Form config, accept/change/toggle/submit |
| `src/components/image-form/image-dropzone.tsx` | Dropzone UI |
| `src/components/image-form/fields.tsx` | Dimension / slider / checkbox / resolution fields |
| `src/components/image-form/form-actions.tsx` | Process + Download + submit error |
| `src/routes/index.tsx` | Pass `className="w-1/4"` to the form |
| `src/components/image-form.tsx` | **Deleted** after folder import resolves |

---

### Task 1: Extract helpers and relocate the form into a folder

**Files:**
- Create: `src/lib/form/first-error.ts`
- Create: `src/lib/download-file.ts`
- Create: `src/components/image-form/fields.tsx`
- Create: `src/components/image-form/image-dropzone.tsx`
- Create: `src/components/image-form/index.tsx`
- Modify: `src/lib/validation/image-form.ts`
- Delete: `src/components/image-form.tsx`

**Interfaces:**
- Consumes: existing form markup and helpers from `src/components/image-form.tsx`
- Produces: `firstError`, `downloadFile`, `ImageDropzone`, field components, `effects` / `defaultImageFormValues` on the schema module; route import `@/components/image-form` still resolves

- [ ] **Step 1: Create `firstError`**

Create `src/lib/form/first-error.ts`:

```ts
export function firstError(
  errors: ReadonlyArray<unknown>
): string | undefined {
  const first = errors[0]
  if (typeof first === "string") return first
  if (
    first &&
    typeof first === "object" &&
    "message" in first &&
    typeof first.message === "string"
  ) {
    return first.message
  }
  return undefined
}
```

- [ ] **Step 2: Create `downloadFile`**

Create `src/lib/download-file.ts`:

```ts
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
```

- [ ] **Step 3: Move `effects` and `defaultImageFormValues` into the schema file**

In `src/lib/validation/image-form.ts`, keep the current schema (still includes `image` — Task 3 removes it). Append:

```ts
export const effects = [
  { name: "grayscale", label: "Grayscale" },
  { name: "sepia", label: "Sepia" },
  { name: "sharpen", label: "Sharpen" },
  { name: "vintage", label: "Vintage" },
] as const satisfies ReadonlyArray<{
  name: keyof ImageFormValues
  label: string
}>

export const adjustments = [
  { name: "brightness", label: "Brightness" },
  { name: "contrast", label: "Contrast" },
  { name: "saturation", label: "Saturation" },
] as const satisfies ReadonlyArray<{
  name: keyof ImageFormValues
  label: string
}>

export const defaultImageFormValues: ImageFormValues = {
  image: null,
  width: null,
  height: null,
  keepRatio: true,
  resolution: 150,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: false,
  sepia: false,
  sharpen: false,
  vintage: false,
}
```

Place these **after** the `ImageFormValues` type export so `keyof ImageFormValues` resolves.

- [ ] **Step 4: Create field components**

Create `src/components/image-form/fields.tsx`. Use the `AnyFieldApi` contract from the design. Move `parseDimension` here as a private function. Replace `OptionGroup` + `Choice` with `ResolutionField`.

```tsx
import type { AnyFieldApi } from "@tanstack/react-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { firstError } from "@/lib/form/first-error"
import { resolutions } from "@/lib/validation/image-form"

function parseDimension(raw: string): number | null {
  if (raw.trim() === "") return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed)
}

export function DimensionField({
  field,
  label,
  onChange,
}: {
  field: AnyFieldApi
  label: string
  onChange: (value: number | null) => void
}) {
  const error = firstError(field.state.meta.errors)
  const id = field.name
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={(field.state.value as number | null) ?? ""}
        aria-invalid={error !== undefined}
        onBlur={field.handleBlur}
        onChange={(event) => onChange(parseDimension(event.target.value))}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function PercentSliderField({
  field,
  label,
}: {
  field: AnyFieldApi
  label: string
}) {
  const id = field.name
  const value = field.state.value as number
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-sm text-muted-foreground">{value}%</span>
      </div>
      <input
        id={id}
        name={id}
        type="range"
        min={0}
        max={200}
        value={value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(Number(event.target.value))}
        className="w-full accent-foreground"
      />
    </div>
  )
}

export function CheckboxField({
  field,
  label,
  onChange,
}: {
  field: AnyFieldApi
  label: string
  onChange?: (checked: boolean) => void
}) {
  const handleChange = onChange ?? ((checked: boolean) => field.handleChange(checked))
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        name={field.name}
        checked={field.state.value as boolean}
        onBlur={field.handleBlur}
        onChange={(event) => handleChange(event.target.checked)}
        className="size-4 accent-foreground"
      />
      {label}
    </label>
  )
}

export function ResolutionField({ field }: { field: AnyFieldApi }) {
  const value = field.state.value as number
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Resolution</legend>
      <div className="flex flex-wrap gap-2">
        {resolutions.map((resolution) => (
          <Button
            key={resolution}
            type="button"
            variant={value === resolution ? "default" : "outline"}
            aria-pressed={value === resolution}
            onClick={() => field.handleChange(resolution)}
          >
            {resolution} dpi
          </Button>
        ))}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 5: Create `ImageDropzone`**

Create `src/components/image-form/image-dropzone.tsx`. Apply the three design edits now: no `takeFile` wrapper, no `useObjectUrl` (treat `file` as the presence boolean), `accept` from exported `imageTypes` — but `imageTypes` is not exported yet. For this task only, hardcode the same accept string as today (`image/jpeg,image/png,image/webp,image/gif`). Task 3 switches it to `imageTypes.join(",")`.

```tsx
import { Upload } from "lucide-react"
import { useRef, useState } from "react"
import type { DragEvent } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "cn"

export function ImageDropzone({
  file,
  error,
  inputId,
  onFile,
}: {
  file: File | null
  error?: string
  inputId: string
  onFile: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    onFile(event.dataTransfer.files.item(0))
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-invalid={error !== undefined}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg border border-dashed border-input px-3 py-1.5 transition-colors",
          dragging && "border-foreground bg-muted",
          error && "border-destructive"
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          name={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null)
            event.target.value = ""
          }}
        />
        {file ? (
          <div className="flex w-full items-center justify-between gap-2">
            <p className="truncate text-sm">{file.name}</p>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onFile(null)}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-center gap-2"
          >
            <Upload className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block text-sm font-medium">
                Drop an image, or browse
              </span>
              <span className="block text-xs text-muted-foreground">
                JPEG, PNG, WebP, or GIF
              </span>
            </span>
          </label>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
```

- [ ] **Step 6: Create `index.tsx` with current behaviour, then delete the old file**

Create `src/components/image-form/index.tsx` by adapting the current `ImageJobForm`:

- Import `defaultImageFormValues`, `effects`, `adjustments` from validation.
- Import `firstError`, `downloadFile`, field components, `ImageDropzone`.
- Keep the ref-based aspect-ratio logic and form-owned `image` field exactly as today (Tasks 2–3 replace them).
- Keep `className="h-full min-h-0 w-1/4"` on the Card for now (Task 5 moves `w-1/4`).
- Map adjustments with `adjustments.map` instead of three hand-written brightness/contrast/saturation blocks.
- Map effects with `CheckboxField` instead of inline labels.

Skeleton of the imports and form setup (keep `setDimension` / `applySourceSize` bodies identical to today's file):

```tsx
import { useForm } from "@tanstack/react-form"
import { useRef } from "react"

import { useImageContext } from "@/components/image-context"
import {
  CheckboxField,
  DimensionField,
  PercentSliderField,
  ResolutionField,
} from "@/components/image-form/fields"
import { ImageDropzone } from "@/components/image-form/image-dropzone"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { downloadFile } from "@/lib/download-file"
import { firstError } from "@/lib/form/first-error"
import { imageProcessFormData } from "@/lib/image/image-request"
import {
  adjustments,
  defaultImageFormValues,
  dimensionSchema,
  effects,
  imageFileSchema,
  imageFormSubmitSchema,
} from "@/lib/validation/image-form"
import { processImageFn } from "@/server/image"

export function ImageJobForm() {
  // ... same refs, useForm({ defaultValues: defaultImageFormValues, ... }),
  // setDimension, applySourceSize, JSX using new field components
}
```

Wire fields like:

```tsx
<form.Field name="width" validators={{ onChange: dimensionSchema.nullable() }}>
  {(field) => (
    <DimensionField
      field={field}
      label="Width (px)"
      onChange={(value) => setDimension("width", value)}
    />
  )}
</form.Field>
```

```tsx
{adjustments.map((adjustment) => (
  <form.Field key={adjustment.name} name={adjustment.name}>
    {(field) => (
      <PercentSliderField field={field} label={adjustment.label} />
    )}
  </form.Field>
))}
```

```tsx
{effects.map((effect) => (
  <form.Field key={effect.name} name={effect.name}>
    {(field) => <CheckboxField field={field} label={effect.label} />}
  </form.Field>
))}
```

Keep the image field + dropzone wiring behaviour the same as today (still form-owned `image`).

Delete `src/components/image-form.tsx` after `index.tsx` exists. Confirm `src/routes/index.tsx` still imports `@/components/image-form` with no change.

- [ ] **Step 7: Verify**

Run:

```bash
npm test
npm run typecheck
npm run lint
```

Expected: all pass. Manually smoke: form still renders, drop image still fills width/height.

- [ ] **Step 8: Commit**

```bash
git add src/lib/form/first-error.ts src/lib/download-file.ts \
  src/lib/validation/image-form.ts \
  src/components/image-form/fields.tsx \
  src/components/image-form/image-dropzone.tsx \
  src/components/image-form/index.tsx
git add -u src/components/image-form.tsx
git commit -m "$(cat <<'EOF'
refactor(image-form): extract helpers and split form into folder

EOF
)"
```

---

### Task 2: Pure aspect-ratio module and `readImageSize`

**Files:**
- Create: `src/lib/image/aspect-ratio.ts`
- Create: `src/lib/image/aspect-ratio.test.ts`
- Create: `src/lib/image/read-image-size.ts`
- Modify: `src/components/image-form/index.tsx`

**Interfaces:**
- Consumes: current ref-based dimension logic in the form
- Produces:
  - `DimensionState`, `ratioOf`, `changeDimension`, `setKeepRatio`, `applySourceSize`
  - `readImageSize(file: File): Promise<{ width: number; height: number } | null>`

- [ ] **Step 1: Write failing aspect-ratio tests**

Create `src/lib/image/aspect-ratio.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  applySourceSize,
  changeDimension,
  ratioOf,
  setKeepRatio,
  type DimensionState,
} from "@/lib/image/aspect-ratio"

const base: DimensionState = {
  width: 200,
  height: 100,
  keepRatio: true,
  lockedRatio: 2,
}

describe("ratioOf", () => {
  it("returns width / height when both are >= 1", () => {
    expect(ratioOf(200, 100)).toBe(2)
  })

  it("returns null when either side is null or < 1", () => {
    expect(ratioOf(null, 100)).toBeNull()
    expect(ratioOf(200, null)).toBeNull()
    expect(ratioOf(0, 100)).toBeNull()
    expect(ratioOf(200, 0)).toBeNull()
  })
})

describe("changeDimension", () => {
  it("only moves the edited side when keepRatio is false", () => {
    const state = { ...base, keepRatio: false }
    expect(changeDimension(state, "width", 300)).toEqual({
      ...state,
      width: 300,
    })
  })

  it("lazy-locks ratio on first edit when lockedRatio is null", () => {
    const state: DimensionState = {
      width: 200,
      height: 100,
      keepRatio: true,
      lockedRatio: null,
    }
    expect(changeDimension(state, "width", 300)).toEqual({
      ...state,
      width: 300,
      lockedRatio: 3,
    })
  })

  it("does not lock when the other side is null", () => {
    const state: DimensionState = {
      width: null,
      height: null,
      keepRatio: true,
      lockedRatio: null,
    }
    expect(changeDimension(state, "width", 300)).toEqual({
      ...state,
      width: 300,
      lockedRatio: null,
    })
  })

  it("follows a locked ratio and never rounds below 1", () => {
    const state: DimensionState = {
      width: 1,
      height: 100,
      keepRatio: true,
      lockedRatio: 0.01,
    }
    expect(changeDimension(state, "width", 1)).toEqual({
      ...state,
      width: 1,
      height: 100,
    })
    // value / lockedRatio would be 1 / 100 = 0.01 → round to 0 → clamp to 1
    const tiny: DimensionState = {
      width: 100,
      height: 1,
      keepRatio: true,
      lockedRatio: 100,
    }
    expect(changeDimension(tiny, "width", 1).height).toBe(1)
  })

  it("leaves the other side and ratio alone when value is null or 0", () => {
    expect(changeDimension(base, "width", null)).toEqual({
      ...base,
      width: null,
    })
    expect(changeDimension(base, "width", 0)).toEqual({
      ...base,
      width: 0,
    })
  })
})

describe("setKeepRatio", () => {
  it("locks from current dims when enabling", () => {
    const state: DimensionState = {
      width: 300,
      height: 150,
      keepRatio: false,
      lockedRatio: null,
    }
    expect(setKeepRatio(state, true)).toEqual({
      ...state,
      keepRatio: true,
      lockedRatio: 2,
    })
  })

  it("clears lockedRatio when disabling", () => {
    expect(setKeepRatio(base, false)).toEqual({
      ...base,
      keepRatio: false,
      lockedRatio: null,
    })
  })
})

describe("applySourceSize", () => {
  it("sets width, height, and lockedRatio for a valid size", () => {
    expect(applySourceSize(base, { width: 640, height: 480 })).toEqual({
      ...base,
      width: 640,
      height: 480,
      lockedRatio: 640 / 480,
    })
  })

  it("returns input unchanged when a dimension is 0", () => {
    expect(applySourceSize(base, { width: 0, height: 480 })).toEqual(base)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/image/aspect-ratio.test.ts
```

Expected: FAIL — module not found / exports missing.

- [ ] **Step 3: Implement `aspect-ratio.ts`**

Create `src/lib/image/aspect-ratio.ts`:

```ts
export type DimensionState = {
  width: number | null
  height: number | null
  keepRatio: boolean
  lockedRatio: number | null
}

export function ratioOf(
  width: number | null,
  height: number | null
): number | null {
  if (width === null || height === null || width < 1 || height < 1) {
    return null
  }
  return width / height
}

export function changeDimension(
  state: DimensionState,
  side: "width" | "height",
  value: number | null
): DimensionState {
  const next: DimensionState = { ...state, [side]: value }

  if (!state.keepRatio || value === null || value < 1) {
    return next
  }

  if (state.lockedRatio === null) {
    return {
      ...next,
      lockedRatio: ratioOf(next.width, next.height),
    }
  }

  const lockedRatio = state.lockedRatio
  if (side === "width") {
    return {
      ...next,
      height: Math.max(1, Math.round(value / lockedRatio)),
    }
  }
  return {
    ...next,
    width: Math.max(1, Math.round(value * lockedRatio)),
  }
}

export function setKeepRatio(
  state: DimensionState,
  keepRatio: boolean
): DimensionState {
  if (!keepRatio) {
    return { ...state, keepRatio: false, lockedRatio: null }
  }
  return {
    ...state,
    keepRatio: true,
    lockedRatio: ratioOf(state.width, state.height),
  }
}

export function applySourceSize(
  state: DimensionState,
  size: { width: number; height: number }
): DimensionState {
  if (size.width < 1 || size.height < 1) return state
  return {
    ...state,
    width: size.width,
    height: size.height,
    lockedRatio: size.width / size.height,
  }
}
```

- [ ] **Step 4: Run aspect-ratio tests**

```bash
npm test -- src/lib/image/aspect-ratio.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create `readImageSize`**

Create `src/lib/image/read-image-size.ts`:

```ts
export async function readImageSize(
  file: File
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return null
  }
}
```

- [ ] **Step 6: Replace ref-based logic in the form with the pure module**

In `src/components/image-form/index.tsx`:

1. Add a form field value for `lockedRatio` **only after Task 3** changes the schema. For this task, keep a local `useState` or continue using a ref that mirrors `lockedRatio` — **prefer**: temporarily store `lockedRatio` in a `useRef<number | null>` still, but route all mutations through the pure functions:

```ts
import * as ratio from "@/lib/image/aspect-ratio"
import { readImageSize } from "@/lib/image/read-image-size"

const lockedRatioRef = useRef<number | null>(null)

function currentDimensionState(): ratio.DimensionState {
  return {
    width: form.getFieldValue("width"),
    height: form.getFieldValue("height"),
    keepRatio: form.getFieldValue("keepRatio"),
    lockedRatio: lockedRatioRef.current,
  }
}

function writeDimensionState(next: ratio.DimensionState) {
  form.setFieldValue("width", next.width)
  form.setFieldValue("height", next.height)
  lockedRatioRef.current = next.lockedRatio
}

function setDimension(side: "width" | "height", value: number | null) {
  writeDimensionState(ratio.changeDimension(currentDimensionState(), side, value))
}

function onKeepRatioChange(checked: boolean) {
  form.setFieldValue("keepRatio", checked)
  const next = ratio.setKeepRatio(
    { ...currentDimensionState(), keepRatio: checked },
    checked
  )
  lockedRatioRef.current = next.lockedRatio
}

async function onSourceFile(file: File) {
  sourceFile.current = file
  const size = await readImageSize(file)
  if (size === null || sourceFile.current !== file) return
  writeDimensionState(ratio.applySourceSize(currentDimensionState(), size))
}
```

Wire Keep ratio checkbox `onChange` to `onKeepRatioChange`. Wire dropzone success path to call `onSourceFile` instead of the old `applySourceSize`.

Task 3 will promote `lockedRatio` into the form schema and drop the ref.

- [ ] **Step 7: Verify**

```bash
npm test
npm run typecheck
```

Expected: PASS. Manual: Keep ratio still links width/height; loading an image seeds both.

- [ ] **Step 8: Commit**

```bash
git add src/lib/image/aspect-ratio.ts src/lib/image/aspect-ratio.test.ts \
  src/lib/image/read-image-size.ts src/components/image-form/index.tsx
git commit -m "$(cat <<'EOF'
feat(image-form): extract pure aspect-ratio rules and readImageSize

EOF
)"
```

---

### Task 3: Schema ownership — drop form `image`, add `lockedRatio`, accept via context

**Files:**
- Modify: `src/lib/validation/image-form.ts`
- Modify: `src/components/image-form/index.tsx`
- Modify: `src/components/image-form/image-dropzone.tsx`

**Interfaces:**
- Consumes: `ratio.*`, `readImageSize`, `imageFileSchema`
- Produces:
  - `imageFormSchema` without `image`, with `lockedRatio: z.number().positive().nullable()`
  - `imageFormSubmitSchema` requiring non-null `width`/`height` only (no `image`)
  - `imageTypes` exported
  - `ImageFormSubmitValues`
  - `acceptImage` behaviour in the form (still inline; Task 5 moves to hook)
  - dropzone `accept={imageTypes.join(",")}`

- [ ] **Step 1: Update the schema**

Replace the schema section of `src/lib/validation/image-form.ts` so it matches:

```ts
import { z } from "zod"

export const resolutions = [72, 150, 300] as const

export const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

export const imageFileSchema = z
  .file("Upload an image")
  .mime([...imageTypes], "Use a JPEG, PNG, WebP, or GIF")

export const dimensionSchema = z
  .number()
  .int("Use a whole number")
  .positive("Must be at least 1")

function percent(label: string) {
  return z
    .number()
    .int()
    .min(0, `${label} must be at least 0`)
    .max(200, `${label} cannot exceed 200`)
}

export const imageFormSchema = z.object({
  width: dimensionSchema.nullable(),
  height: dimensionSchema.nullable(),
  keepRatio: z.boolean(),
  lockedRatio: z.number().positive().nullable(),
  resolution: z.union([z.literal(72), z.literal(150), z.literal(300)]),
  brightness: percent("Brightness"),
  contrast: percent("Contrast"),
  saturation: percent("Saturation"),
  grayscale: z.boolean(),
  sepia: z.boolean(),
  sharpen: z.boolean(),
  vintage: z.boolean(),
})

export const imageFormSubmitSchema = imageFormSchema.extend({
  width: dimensionSchema,
  height: dimensionSchema,
})

export type ImageFormValues = z.infer<typeof imageFormSchema>
export type ImageFormSubmitValues = z.infer<typeof imageFormSubmitSchema>
export type Resolution = ImageFormValues["resolution"]
```

Update `defaultImageFormValues` — remove `image`, add `lockedRatio: null`:

```ts
export const defaultImageFormValues: ImageFormValues = {
  width: null,
  height: null,
  keepRatio: true,
  lockedRatio: null,
  resolution: 150,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: false,
  sepia: false,
  sharpen: false,
  vintage: false,
}
```

Keep `effects` and `adjustments` as added in Task 1 (they still type-check against `keyof ImageFormValues`).

- [ ] **Step 2: Point dropzone `accept` at `imageTypes`**

In `image-dropzone.tsx`:

```tsx
import { imageTypes } from "@/lib/validation/image-form"
// ...
accept={imageTypes.join(",")}
```

- [ ] **Step 3: Rewrite form image ownership to context via `acceptImage`**

In `index.tsx`:

1. Remove the `form.Field name="image"` wrapper.
2. Add React state: `imageError` (`string | null`), keep using context `image` / `setImage` / `setProcessedImage`.
3. Replace `lockedRatioRef` with form field `lockedRatio` — `currentDimensionState` reads `form.getFieldValue("lockedRatio")`; `writeDimensionState` uses `form.setFieldValue("lockedRatio", ...)`.
4. Set validators to form-level only:

```ts
const form = useForm({
  defaultValues: defaultImageFormValues,
  validators: {
    onChange: imageFormSchema,
    onSubmit: imageFormSubmitSchema,
  },
  onSubmit: async ({ value }) => {
    // still the old inline submit for now — Task 4 extracts processImageJob
    // but stop reading value.image; use context `image` instead
  },
})
```

5. Implement `acceptImage` (inline for now):

```ts
const latestAccepted = useRef<File | null>(null)
const [imageError, setImageError] = useState<string | null>(null)

async function acceptImage(file: File | null) {
  if (file === null) {
    setImage(null)
    setProcessedImage(null)
    setImageError(null)
    latestAccepted.current = null
    return
  }

  const parsed = imageFileSchema.safeParse(file)
  if (!parsed.success) {
    setImageError(parsed.error.issues[0]?.message ?? "Upload an image")
    return
  }

  setImageError(null)
  setImage(file)
  setProcessedImage(null)
  latestAccepted.current = file

  const size = await readImageSize(file)
  if (size === null || latestAccepted.current !== file) return
  writeDimensionState(ratio.applySourceSize(currentDimensionState(), size))
}
```

6. Render dropzone:

```tsx
<ImageDropzone
  file={image}
  error={imageError ?? undefined}
  inputId="image"
  onFile={(file) => {
    void acceptImage(file)
  }}
/>
```

7. Remove per-field `validators` on width/height/image.
8. Update Keep ratio to use `CheckboxField` with `onChange` that sets `keepRatio` then writes `lockedRatio` via `ratio.setKeepRatio`.
9. Update `onSubmit` to use context `image` (defensive null check) and `imageFormSubmitSchema.parse(value)` for width/height narrowing — still inline call to `processImageFn` until Task 4.

```ts
onSubmit: async ({ value }) => {
  if (!image) return
  const values = imageFormSubmitSchema.parse(value)
  const body = imageProcessFormData({
    image,
    resolution: values.resolution,
    width: values.width,
    height: values.height,
    brightness: values.brightness,
    contrast: values.contrast,
    saturation: values.saturation,
    grayscale: values.grayscale,
  })
  const response = await processImageFn({ data: body })
  const bytes = await response.arrayBuffer()
  setProcessedImage(
    new File([bytes], image.name, {
      type: response.headers.get("content-type") ?? image.type,
    })
  )
},
```

Note: `image` in the closure must be the latest context value. Prefer reading from a ref synced with `image`, or define `onSubmit` to close over context carefully — the Task 5 hook will read `image` from context at submit time. For this task, calling `useImageContext()` and using `image` inside `onSubmit` is acceptable if the form is recreated… Actually TanStack Form keeps the original `onSubmit`. Sync with a ref:

```ts
const imageRef = useRef(image)
imageRef.current = image
// in onSubmit: const file = imageRef.current
```

- [ ] **Step 4: Verify intentional behaviour changes**

```bash
npm test
npm run typecheck
```

Manual (design § Behaviour changes):

1. Drop PNG → preview + dimensions.
2. Remove → preview clears, Download disabled.
3. Drop `.txt` → error under dropzone, preview unchanged.
4. Drop a second image after processing → processed preview clears.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/image-form.ts \
  src/components/image-form/index.tsx \
  src/components/image-form/image-dropzone.tsx
git commit -m "$(cat <<'EOF'
refactor(image-form): move image ownership to context and add lockedRatio

EOF
)"
```

---

### Task 4: `processImageJob` and visible submit lifecycle

**Files:**
- Create: `src/lib/image/process-image-job.ts`
- Create: `src/lib/image/process-image-job.test.ts`
- Create: `src/components/image-form/form-actions.tsx`
- Modify: `src/components/image-form/index.tsx`

**Interfaces:**
- Consumes: `imageProcessFormData`, `processImageFn`, `ImageFormSubmitValues`
- Produces:
  - `processImageJob(image: File, values: ImageFormSubmitValues): Promise<File>`
  - `fileFromResponse(response: Response, bytes: ArrayBuffer, source: File): File`
  - `FormActions({ pending, canSubmit, submitError })`

- [ ] **Step 1: Write failing `fileFromResponse` test**

Create `src/lib/image/process-image-job.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { fileFromResponse } from "@/lib/image/process-image-job"

describe("fileFromResponse", () => {
  const source = new File([new Uint8Array([1])], "photo.png", {
    type: "image/png",
  })

  it("uses the source name and prefers the response content-type", () => {
    const response = new Response(null, {
      headers: { "content-type": "image/webp" },
    })
    const file = fileFromResponse(response, new Uint8Array([9]).buffer, source)
    expect(file.name).toBe("photo.png")
    expect(file.type).toBe("image/webp")
  })

  it("falls back to the source type when the header is missing", () => {
    const response = new Response(null)
    const file = fileFromResponse(response, new Uint8Array([9]).buffer, source)
    expect(file.type).toBe("image/png")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/image/process-image-job.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `process-image-job.ts`**

Create `src/lib/image/process-image-job.ts`:

```ts
import { imageProcessFormData } from "@/lib/image/image-request"
import type { ImageFormSubmitValues } from "@/lib/validation/image-form"
import { processImageFn } from "@/server/image"

export function fileFromResponse(
  response: Response,
  bytes: ArrayBuffer,
  source: File
): File {
  return new File([bytes], source.name, {
    type: response.headers.get("content-type") ?? source.type,
  })
}

export async function processImageJob(
  image: File,
  values: ImageFormSubmitValues
): Promise<File> {
  const body = imageProcessFormData({
    image,
    resolution: values.resolution,
    width: values.width,
    height: values.height,
    brightness: values.brightness,
    contrast: values.contrast,
    saturation: values.saturation,
    grayscale: values.grayscale,
  })
  const response = await processImageFn({ data: body })
  const bytes = await response.arrayBuffer()
  return fileFromResponse(response, bytes, image)
}
```

- [ ] **Step 4: Run process-image-job tests**

```bash
npm test -- src/lib/image/process-image-job.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create `FormActions`**

Create `src/components/image-form/form-actions.tsx`:

```tsx
import { useImageContext } from "@/components/image-context"
import { Button } from "@/components/ui/button"
import { downloadFile } from "@/lib/download-file"

export function FormActions({
  pending,
  canSubmit,
  submitError,
}: {
  pending: boolean
  canSubmit: boolean
  submitError: string | null
}) {
  const { image, processedImage } = useImageContext()
  const downloadable = processedImage ?? image

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-row gap-2">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? "Processing…" : "Process image"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!downloadable}
          onClick={() => {
            if (downloadable) downloadFile(downloadable)
          }}
        >
          Download Image
        </Button>
      </div>
      {submitError ? (
        <p className="text-xs text-destructive">{submitError}</p>
      ) : null}
    </div>
  )
}
```

Same button row as today; error sits under the buttons without redesigning the card.

- [ ] **Step 6: Wire submit lifecycle in the form**

In `index.tsx`:

1. Add `const [submitError, setSubmitError] = useState<string | null>(null)`.
2. Clear it in `acceptImage` at the start (`setSubmitError(null)`).
3. Replace inline `processImageFn` usage:

```ts
onSubmit: async ({ value }) => {
  const file = imageRef.current
  if (!file) {
    setSubmitError("Upload an image")
    return
  }
  const values = imageFormSubmitSchema.parse(value)
  setSubmitError(null)
  try {
    setProcessedImage(await processImageJob(file, values))
  } catch (error) {
    setSubmitError(
      error instanceof Error ? error.message : "Image processing failed"
    )
  }
},
```

4. Replace the footer buttons with:

```tsx
<CardFooter className="shrink-0 flex-row gap-2">
  <form.Subscribe selector={(s) => s.isSubmitting}>
    {(isSubmitting) => (
      <FormActions
        pending={isSubmitting}
        canSubmit={image !== null}
        submitError={submitError}
      />
    )}
  </form.Subscribe>
</CardFooter>
```

Remove direct `downloadFile` / Process `Button` usage from `index.tsx`.

- [ ] **Step 7: Verify**

```bash
npm test
npm run typecheck
```

Manual:

1. Process → button shows "Processing…" and is disabled; result appears.
2. Process with server stopped → footer error; form values intact.
3. Process with no image → button disabled (`canSubmit={false}`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/image/process-image-job.ts \
  src/lib/image/process-image-job.test.ts \
  src/components/image-form/form-actions.tsx \
  src/components/image-form/index.tsx
git commit -m "$(cat <<'EOF'
feat(image-form): extract processImageJob and show submit lifecycle

EOF
)"
```

---

### Task 5: Extract `useImageJobForm` and collapse the form to wiring

**Files:**
- Create: `src/components/image-form/use-image-job-form.ts`
- Modify: `src/components/image-form/index.tsx`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–4
- Produces:

```ts
export function useImageJobForm(): {
  form: /* ReturnType of useForm — leave inferred, do not annotate by hand */
  image: File | null
  imageError: string | null
  submitError: string | null
  acceptImage: (file: File | null) => void
  changeDimension: (side: "width" | "height", value: number | null) => void
  toggleKeepRatio: (checked: boolean) => void
}
```

- Form card loses `w-1/4`; route passes `className="w-1/4"`.
- `index.tsx` target ≤ 100 lines.

- [ ] **Step 1: Create the hook**

Create `src/components/image-form/use-image-job-form.ts` by moving all form logic out of `index.tsx`:

```ts
import { useForm } from "@tanstack/react-form"
import { useRef, useState } from "react"

import { useImageContext } from "@/components/image-context"
import * as ratio from "@/lib/image/aspect-ratio"
import { processImageJob } from "@/lib/image/process-image-job"
import { readImageSize } from "@/lib/image/read-image-size"
import {
  defaultImageFormValues,
  imageFileSchema,
  imageFormSchema,
  imageFormSubmitSchema,
} from "@/lib/validation/image-form"

export function useImageJobForm() {
  const { image, setImage, setProcessedImage } = useImageContext()
  const [imageError, setImageError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const latestAccepted = useRef<File | null>(null)
  const imageRef = useRef(image)
  imageRef.current = image

  const form = useForm({
    defaultValues: defaultImageFormValues,
    validators: {
      onChange: imageFormSchema,
      onSubmit: imageFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const file = imageRef.current
      if (!file) {
        setSubmitError("Upload an image")
        return
      }
      const values = imageFormSubmitSchema.parse(value)
      setSubmitError(null)
      try {
        setProcessedImage(await processImageJob(file, values))
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "Image processing failed"
        )
      }
    },
  })

  function currentDimensionState(): ratio.DimensionState {
    return {
      width: form.getFieldValue("width"),
      height: form.getFieldValue("height"),
      keepRatio: form.getFieldValue("keepRatio"),
      lockedRatio: form.getFieldValue("lockedRatio"),
    }
  }

  function writeDimensionState(next: ratio.DimensionState) {
    form.setFieldValue("width", next.width)
    form.setFieldValue("height", next.height)
    form.setFieldValue("lockedRatio", next.lockedRatio)
  }

  function changeDimension(side: "width" | "height", value: number | null) {
    writeDimensionState(
      ratio.changeDimension(currentDimensionState(), side, value)
    )
  }

  function toggleKeepRatio(checked: boolean) {
    form.setFieldValue("keepRatio", checked)
    const next = ratio.setKeepRatio(
      { ...currentDimensionState(), keepRatio: checked },
      checked
    )
    form.setFieldValue("lockedRatio", next.lockedRatio)
  }

  async function acceptImage(file: File | null) {
    setSubmitError(null)
    if (file === null) {
      setImage(null)
      setProcessedImage(null)
      setImageError(null)
      latestAccepted.current = null
      return
    }

    const parsed = imageFileSchema.safeParse(file)
    if (!parsed.success) {
      setImageError(parsed.error.issues[0]?.message ?? "Upload an image")
      return
    }

    setImageError(null)
    setImage(file)
    setProcessedImage(null)
    latestAccepted.current = file

    const size = await readImageSize(file)
    if (size === null || latestAccepted.current !== file) return
    writeDimensionState(ratio.applySourceSize(currentDimensionState(), size))
  }

  return {
    form,
    image,
    imageError,
    submitError,
    acceptImage,
    changeDimension,
    toggleKeepRatio,
  }
}
```

- [ ] **Step 2: Collapse `index.tsx` to wiring + layout**

Replace `src/components/image-form/index.tsx` with approximately:

```tsx
import {
  CheckboxField,
  DimensionField,
  PercentSliderField,
  ResolutionField,
} from "@/components/image-form/fields"
import { FormActions } from "@/components/image-form/form-actions"
import { ImageDropzone } from "@/components/image-form/image-dropzone"
import { useImageJobForm } from "@/components/image-form/use-image-job-form"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { adjustments, effects } from "@/lib/validation/image-form"
import { cn } from "cn"

export function ImageJobForm({ className }: { className?: string }) {
  const {
    form,
    image,
    imageError,
    submitError,
    acceptImage,
    changeDimension,
    toggleKeepRatio,
  } = useImageJobForm()

  return (
    <Card size="sm" className={cn("h-full min-h-0", className)}>
      <CardHeader className="shrink-0">
        <CardTitle>Processing Options</CardTitle>
      </CardHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <ImageDropzone
            file={image}
            error={imageError ?? undefined}
            inputId="image"
            onFile={(file) => {
              void acceptImage(file)
            }}
          />

          <fieldset className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <form.Field name="width">
                {(field) => (
                  <DimensionField
                    field={field}
                    label="Width (px)"
                    onChange={(value) => changeDimension("width", value)}
                  />
                )}
              </form.Field>
              <form.Field name="height">
                {(field) => (
                  <DimensionField
                    field={field}
                    label="Height (px)"
                    onChange={(value) => changeDimension("height", value)}
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="keepRatio">
              {(field) => (
                <CheckboxField
                  field={field}
                  label="Keep ratio"
                  onChange={toggleKeepRatio}
                />
              )}
            </form.Field>
          </fieldset>

          <form.Field name="resolution">
            {(field) => <ResolutionField field={field} />}
          </form.Field>

          {adjustments.map((adjustment) => (
            <form.Field key={adjustment.name} name={adjustment.name}>
              {(field) => (
                <PercentSliderField field={field} label={adjustment.label} />
              )}
            </form.Field>
          ))}

          <div className="grid grid-cols-2 gap-2">
            {effects.map((effect) => (
              <form.Field key={effect.name} name={effect.name}>
                {(field) => (
                  <CheckboxField field={field} label={effect.label} />
                )}
              </form.Field>
            ))}
          </div>
        </CardContent>

        <CardFooter className="shrink-0 flex-row gap-2">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <FormActions
                pending={isSubmitting}
                canSubmit={image !== null}
                submitError={submitError}
              />
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  )
}
```

Confirm the file is ≤ 100 lines (design target). If slightly over because of formatting, prefer compactness over comments — do not extract further without need.

- [ ] **Step 3: Move `w-1/4` to the route**

In `src/routes/index.tsx`:

```tsx
<ImageJobForm className="w-1/4" />
```

- [ ] **Step 4: Final verification**

```bash
npm test
npm run typecheck
npm run lint
npm run check
```

Expected: all green.

Manual checklist from the design:

1. Drop a PNG → width/height populate, preview shows it.
2. Edit width with Keep ratio on → height follows; toggle off → independent; toggle on → ratio re-locks from current values.
3. Click Remove → preview empties, Download disabled.
4. Drop a `.txt` → error under dropzone, preview unchanged.
5. Process → "Processing…", disabled; result appears; Download gives processed file.
6. Process with dev server stopped → error in footer, form intact.

- [ ] **Step 5: Commit**

```bash
git add src/components/image-form/use-image-job-form.ts \
  src/components/image-form/index.tsx \
  src/routes/index.tsx
git commit -m "$(cat <<'EOF'
refactor(image-form): extract useImageJobForm and shrink form to wiring

EOF
)"
```

---

## Self-Review Checklist (author)

| Spec requirement | Task |
|---|---|
| `firstError` / `downloadFile` moved to lib | Task 1 |
| Dropzone + fields in folder; `useObjectUrl` deleted | Task 1 |
| `effects` / `adjustments` / `defaultImageFormValues` on schema | Task 1 (+ Task 3 for `lockedRatio`) |
| Pure `aspect-ratio` + tests | Task 2 |
| `readImageSize` | Task 2 |
| Schema drops `image`, adds `lockedRatio`, exports `imageTypes` | Task 3 |
| Context owns image; `acceptImage` race guard | Task 3 |
| Form-level validators only | Task 3 |
| Behaviour changes 1–3 (remove/clear/reject type) | Task 3 |
| `processImageJob` + `fileFromResponse` test | Task 4 |
| Pending + `submitError` via `FormActions` / Subscribe | Task 4 |
| Behaviour change 4 (disabled / visible failure) | Task 4 |
| `useImageJobForm`; index ≤ 100 lines; `w-1/4` on route | Task 5 |
| No server / image-request / encode / context changes | Global Constraints |
| Unsupported effects untouched | Global Constraints |

No TBD/TODO placeholders. Types and names match across tasks (`changeDimension` / `toggleKeepRatio` / `acceptImage` / `ImageFormSubmitValues` / `lockedRatio`).
