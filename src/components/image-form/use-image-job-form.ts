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
        const processed = await processImageJob(file, values)
        // Drop the result if the image was replaced or removed mid-flight.
        if (imageRef.current === file) setProcessedImage(processed)
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
