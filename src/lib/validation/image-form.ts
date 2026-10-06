import { z } from "zod"

export const resolutions = [72, 150, 300] as const

const imageTypes = [
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
  image: imageFileSchema.nullable(),
  width: dimensionSchema.nullable(),
  height: dimensionSchema.nullable(),
  keepRatio: z.boolean(),
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
  image: imageFileSchema,
  width: dimensionSchema,
  height: dimensionSchema,
})

export type ImageFormValues = z.infer<typeof imageFormSchema>
export type Resolution = ImageFormValues["resolution"]
