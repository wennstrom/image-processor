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
