import { useForm } from "@tanstack/react-form"
import { Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { DragEvent, ReactNode } from "react"
import { useImageContext } from "@/components/image-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { imageProcessFormData } from "@/lib/image/image-request"
import { processImageFn } from "@/server/image"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  dimensionSchema,
  imageFileSchema,
  imageFormSubmitSchema,
  resolutions,
} from "@/lib/validation/image-form"
import type { ImageFormValues } from "@/lib/validation/image-form"
import { cn } from "cn"

const effects = [
  { name: "grayscale", label: "Grayscale" },
  { name: "sepia", label: "Sepia" },
  { name: "sharpen", label: "Sharpen" },
  { name: "vintage", label: "Vintage" },
] as const satisfies ReadonlyArray<{
  name: keyof ImageFormValues
  label: string
}>

const defaultValues: ImageFormValues = {
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

export function ImageJobForm() {
  const { image, processedImage, setImage, setProcessedImage } =
    useImageContext()
  const downloadable = processedImage ?? image
  const aspectRatio = useRef<number | null>(null)
  const sourceFile = useRef<File | null>(null)

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: imageFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const file = value.image
      if (!file || value.width === null || value.height === null) return

      const body = imageProcessFormData({
        image: file,
        resolution: value.resolution,
        width: value.width,
        height: value.height,
        brightness: value.brightness,
        contrast: value.contrast,
        saturation: value.saturation,
        grayscale: value.grayscale,
      })

      const response = await processImageFn({ data: body })
      const bytes = await response.arrayBuffer()
      setProcessedImage(
        new File([bytes], file.name, {
          type: response.headers.get("content-type") ?? file.type,
        })
      )
    },
  })

  function setDimension(field: "width" | "height", value: number | null) {
    form.setFieldValue(field, value)
    if (value === null || value < 1 || !form.getFieldValue("keepRatio")) return

    const ratio = aspectRatio.current
    if (!ratio) {
      const other = form.getFieldValue(field === "width" ? "height" : "width")
      if (other !== null && other >= 1) {
        aspectRatio.current = field === "width" ? value / other : other / value
      }
      return
    }

    if (field === "width") {
      form.setFieldValue("height", Math.max(1, Math.round(value / ratio)))
    } else {
      form.setFieldValue("width", Math.max(1, Math.round(value * ratio)))
    }
  }

  async function applySourceSize(file: File) {
    sourceFile.current = file
    try {
      const bitmap = await createImageBitmap(file)
      const { width, height } = bitmap
      bitmap.close()
      if (sourceFile.current !== file || width < 1 || height < 1) return
      aspectRatio.current = width / height
      form.setFieldValue("width", width)
      form.setFieldValue("height", height)
    } catch {
      // Leave the size fields as the user set them.
    }
  }

  return (
    <Card size="sm" className="h-full min-h-0 w-1/4">
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
          <form.Field
            name="image"
            validators={{ onChange: imageFileSchema.nullable() }}
          >
            {(field) => (
              <ImageDropzone
                file={field.state.value}
                error={firstError(field.state.meta.errors)}
                inputId={field.name}
                onFile={(file) => {
                  field.handleChange(file)
                  if (file) {
                    setImage(file)
                    void applySourceSize(file)
                  }
                }}
              />
            )}
          </form.Field>

          <fieldset className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <form.Field
                name="width"
                validators={{ onChange: dimensionSchema.nullable() }}
              >
                {(field) => (
                  <DimensionInput
                    id={field.name}
                    label="Width (px)"
                    value={field.state.value}
                    error={firstError(field.state.meta.errors)}
                    onBlur={field.handleBlur}
                    onChange={(value) => setDimension("width", value)}
                  />
                )}
              </form.Field>
              <form.Field
                name="height"
                validators={{ onChange: dimensionSchema.nullable() }}
              >
                {(field) => (
                  <DimensionInput
                    id={field.name}
                    label="Height (px)"
                    value={field.state.value}
                    error={firstError(field.state.meta.errors)}
                    onBlur={field.handleBlur}
                    onChange={(value) => setDimension("height", value)}
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="keepRatio">
              {(field) => (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name={field.name}
                    checked={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      const checked = event.target.checked
                      field.handleChange(checked)
                      if (!checked) return
                      const width = form.getFieldValue("width")
                      const height = form.getFieldValue("height")
                      if (
                        width !== null &&
                        height !== null &&
                        width >= 1 &&
                        height >= 1
                      ) {
                        aspectRatio.current = width / height
                      }
                    }}
                    className="size-4 accent-foreground"
                  />
                  Keep ratio
                </label>
              )}
            </form.Field>
          </fieldset>

          <form.Field name="resolution">
            {(field) => (
              <OptionGroup label="Resolution">
                {resolutions.map((resolution) => (
                  <Choice
                    key={resolution}
                    pressed={field.state.value === resolution}
                    onClick={() => field.handleChange(resolution)}
                  >
                    {resolution} dpi
                  </Choice>
                ))}
              </OptionGroup>
            )}
          </form.Field>

          <form.Field name="brightness">
            {(field) => (
              <PercentSlider
                id={field.name}
                label="Brightness"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>

          <form.Field name="contrast">
            {(field) => (
              <PercentSlider
                id={field.name}
                label="Contrast"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>

          <form.Field name="saturation">
            {(field) => (
              <PercentSlider
                id={field.name}
                label="Saturation"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-2">
            {effects.map((effect) => (
              <form.Field key={effect.name} name={effect.name}>
                {(field) => (
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      name={field.name}
                      checked={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.checked)
                      }
                      className="size-4 accent-foreground"
                    />
                    {effect.label}
                  </label>
                )}
              </form.Field>
            ))}
          </div>
        </CardContent>
        <CardFooter className="shrink-0 flex-row gap-2">
          <Button type="submit">Process image</Button>
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
        </CardFooter>
      </form>
    </Card>
  )
}

function ImageDropzone({
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
  const previewUrl = useObjectUrl(file)

  function takeFile(next: File | null) {
    onFile(next)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    takeFile(event.dataTransfer.files.item(0))
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
            takeFile(event.target.files?.[0] ?? null)
            event.target.value = ""
          }}
        />
        {previewUrl && file ? (
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
                onClick={() => takeFile(null)}
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

function DimensionInput({
  id,
  label,
  value,
  error,
  onBlur,
  onChange,
}: {
  id: string
  label: string
  value: number | null
  error?: string
  onBlur: () => void
  onChange: (value: number | null) => void
}) {
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
        value={value ?? ""}
        aria-invalid={error !== undefined}
        onBlur={onBlur}
        onChange={(event) => onChange(parseDimension(event.target.value))}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function parseDimension(raw: string) {
  if (raw.trim() === "") return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed)
}

function PercentSlider({
  id,
  label,
  value,
  onBlur,
  onChange,
}: {
  id: string
  label: string
  value: number
  onBlur: () => void
  onChange: (value: number) => void
}) {
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
        onBlur={onBlur}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-foreground"
      />
    </div>
  )
}

function OptionGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

function Choice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }

    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])

  return url
}

function firstError(errors: ReadonlyArray<unknown>) {
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
