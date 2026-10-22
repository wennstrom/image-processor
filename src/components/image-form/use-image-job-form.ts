import { useStore } from "@tanstack/react-form"
import { useEffect, useRef, useState } from "react"

import { useImageContext } from "@/components/image-context"
import { useAppForm } from "@/lib/form/form"
import * as ratio from "@/lib/image/aspect-ratio"
import {
  basenameOf,
  formatFromMime,
  mimeForFormat,
  outputFilename,
} from "@/lib/image/output-file"
import { processImageJob } from "@/lib/image/process-image-job"
import { readImageSize } from "@/lib/image/read-image-size"
import {
  defaultImageFormValues,
  imageFileSchema,
  imageFormSchema,
  imageFormSubmitSchema,
} from "@/lib/validation/image-form"
import type { OutputFormat } from "@/lib/validation/image-form"

const PROCESS_DEBOUNCE_MS = 100

function jobInputKey(values: {
  width: number | null
  height: number | null
  resolution: number
  format: OutputFormat
  brightness: number
  contrast: number
  saturation: number
  grayscale: boolean
  sepia: boolean
  sharpen: boolean
  vintage: boolean
}): string {
  return [
    values.width,
    values.height,
    values.resolution,
    values.format,
    values.brightness,
    values.contrast,
    values.saturation,
    values.grayscale,
    values.sepia,
    values.sharpen,
    values.vintage,
  ].join("|")
}

export function useImageJobForm() {
  const { image, setImage, processedImage, setProcessedImage } =
    useImageContext()
  const [imageError, setImageError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const latestAccepted = useRef<File | null>(null)
  const imageRef = useRef(image)
  imageRef.current = image
  const requestId = useRef(0)
  const skipJobKeyRef = useRef<string | null>(null)

  const form = useAppForm({
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
      const id = ++requestId.current
      setSubmitError(null)
      try {
        const processed = await processImageJob(file, values)
        // Drop the result if a newer request started or the image changed.
        if (requestId.current === id && imageRef.current === file) {
          setProcessedImage(processed)
        }
      } catch (error) {
        if (requestId.current === id && imageRef.current === file) {
          setSubmitError(
            error instanceof Error ? error.message : "Image processing failed"
          )
        }
      }
    },
  })

  const jobKey = useStore(form.store, (state) => jobInputKey(state.values))
  const outputName = useStore(form.store, (state) => state.values.name)
  const outputFormat = useStore(form.store, (state) => state.values.format)

  useEffect(() => {
    if (!image) return
    if (skipJobKeyRef.current === jobKey) return
    if (!imageFormSubmitSchema.safeParse(form.state.values).success) return

    const timeout = window.setTimeout(() => {
      void form.handleSubmit()
    }, PROCESS_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [form, image, jobKey])

  useEffect(() => {
    if (!processedImage) return
    const nextName = outputFilename(outputName, outputFormat)
    if (processedImage.name === nextName) return
    if (processedImage.type !== mimeForFormat(outputFormat)) return

    setProcessedImage(
      new File([processedImage], nextName, { type: processedImage.type })
    )
  }, [outputName, outputFormat, processedImage, setProcessedImage])

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

  function applySourceMeta(file: File) {
    const name = basenameOf(file.name) || "image"
    const format = formatFromMime(file.type) ?? defaultImageFormValues.format
    form.setFieldValue("name", name)
    form.setFieldValue("format", format)
    return { name, format }
  }

  async function acceptImage(file: File | null) {
    setSubmitError(null)
    requestId.current += 1
    skipJobKeyRef.current = null
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
    applySourceMeta(file)

    const size = await readImageSize(file)
    if (size === null || latestAccepted.current !== file) return
    writeDimensionState(ratio.applySourceSize(currentDimensionState(), size))
  }

  async function resetToOriginal() {
    const file = imageRef.current
    if (!file) return

    requestId.current += 1
    setSubmitError(null)
    setProcessedImage(null)
    form.reset()

    const meta = applySourceMeta(file)
    const size = await readImageSize(file)
    if (imageRef.current !== file) return

    const base: ratio.DimensionState = {
      width: null,
      height: null,
      keepRatio: defaultImageFormValues.keepRatio,
      lockedRatio: null,
    }
    const next = size === null ? base : ratio.applySourceSize(base, size)
    writeDimensionState(next)
    skipJobKeyRef.current = jobInputKey({
      ...defaultImageFormValues,
      format: meta.format,
      width: next.width,
      height: next.height,
    })
  }

  return {
    form,
    image,
    imageError,
    submitError,
    acceptImage,
    resetToOriginal,
    changeDimension,
    toggleKeepRatio,
  }
}
