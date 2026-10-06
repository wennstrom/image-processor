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
  const { image, processedImage, setImage, setProcessedImage } =
    useImageContext()
  const downloadable = processedImage ?? image
  const aspectRatio = useRef<number | null>(null)
  const sourceFile = useRef<File | null>(null)

  const form = useForm({
    defaultValues: defaultImageFormValues,
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
                  <DimensionField
                    field={field}
                    label="Width (px)"
                    onChange={(value) => setDimension("width", value)}
                  />
                )}
              </form.Field>
              <form.Field
                name="height"
                validators={{ onChange: dimensionSchema.nullable() }}
              >
                {(field) => (
                  <DimensionField
                    field={field}
                    label="Height (px)"
                    onChange={(value) => setDimension("height", value)}
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="keepRatio">
              {(field) => (
                <CheckboxField
                  field={field}
                  label="Keep ratio"
                  onChange={(checked) => {
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
