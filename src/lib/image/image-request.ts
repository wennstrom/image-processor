import { z } from "zod"

import type { Resolution } from "@/lib/validation/image-form"
import { resolutions } from "@/lib/validation/image-form"

const allowedDpi = new Set<number>(resolutions)

function percent(label: string) {
  return z
    .number()
    .int()
    .min(0, `${label} must be at least 0`)
    .max(200, `${label} cannot exceed 200`)
}

export const imageRequestSchema = z.object({
  image: z.instanceof(File, { message: "Upload an image" }),
  dpi: z.custom<Resolution>(
    (value) => typeof value === "number" && allowedDpi.has(value),
    "Resolution must be 72, 150, or 300 dpi"
  ),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  brightness: percent("Brightness"),
  contrast: percent("Contrast"),
  saturation: percent("Saturation"),
  grayscale: z.boolean(),
})

export type ImageProcessRequest = z.infer<typeof imageRequestSchema>

export function imageProcessFormData(value: {
  image: File
  resolution: Resolution
  width: number
  height: number
  brightness: number
  contrast: number
  saturation: number
  grayscale: boolean
}) {
  const body = new FormData()
  body.set("image", value.image)
  body.set("dpi", String(value.resolution))
  body.set("width", String(value.width))
  body.set("height", String(value.height))
  body.set("brightness", String(value.brightness))
  body.set("contrast", String(value.contrast))
  body.set("saturation", String(value.saturation))
  body.set("grayscale", String(value.grayscale))
  return body
}

function formNumber(data: FormData, key: string) {
  return Number(data.get(key))
}

export function parseImageRequest(data: FormData) {
  if (!(data instanceof FormData)) {
    throw new Error("Expected form data")
  }

  return imageRequestSchema.parse({
    image: data.get("image"),
    dpi: formNumber(data, "dpi"),
    width: formNumber(data, "width"),
    height: formNumber(data, "height"),
    brightness: formNumber(data, "brightness"),
    contrast: formNumber(data, "contrast"),
    saturation: formNumber(data, "saturation"),
    grayscale: data.get("grayscale") === "true",
  })
}
