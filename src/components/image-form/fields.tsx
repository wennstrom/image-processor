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
  const handleChange =
    onChange ?? ((checked: boolean) => field.handleChange(checked))
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
