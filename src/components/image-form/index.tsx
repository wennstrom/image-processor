import { useForm } from "@tanstack/react-form"
import { useRef, useState } from "react"

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
import * as ratio from "@/lib/image/aspect-ratio"
import { imageProcessFormData } from "@/lib/image/image-request"
import { readImageSize } from "@/lib/image/read-image-size"
import {
  adjustments,
  defaultImageFormValues,
  effects,
  imageFileSchema,
  imageFormSchema,
  imageFormSubmitSchema,
} from "@/lib/validation/image-form"
import { processImageFn } from "@/server/image"

export function ImageJobForm() {
  const { image, processedImage, setImage, setProcessedImage } =
    useImageContext()
  const downloadable = processedImage ?? image
  const imageRef = useRef(image)
  imageRef.current = image
  const latestAccepted = useRef<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: defaultImageFormValues,
    validators: {
      onChange: imageFormSchema,
      onSubmit: imageFormSubmitSchema,
    },
    onSubmit: async ({ value }) => {
      const file = imageRef.current
      if (!file) return
      const values = imageFormSubmitSchema.parse(value)

      const body = imageProcessFormData({
        image: file,
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
        new File([bytes], file.name, {
          type: response.headers.get("content-type") ?? file.type,
        })
      )
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

  function setDimension(side: "width" | "height", value: number | null) {
    writeDimensionState(
      ratio.changeDimension(currentDimensionState(), side, value)
    )
  }

  function onKeepRatioChange(checked: boolean) {
    form.setFieldValue("keepRatio", checked)
    writeDimensionState(
      ratio.setKeepRatio(
        { ...currentDimensionState(), keepRatio: checked },
        checked
      )
    )
  }

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
                    onChange={(value) => setDimension("width", value)}
                  />
                )}
              </form.Field>
              <form.Field name="height">
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
                  onChange={onKeepRatioChange}
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
