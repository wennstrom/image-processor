import { z } from "zod"

export const outputFormats = ["jpeg", "png", "webp"] as const

export const imageJobSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, "Enter a filename")
    .max(255, "Filename must be 255 characters or fewer")
    .refine((value) => !value.includes("/") && !value.includes("\\"), {
      message: "Filename cannot include a path",
    }),
  format: z.enum(outputFormats),
  maxEdge: z
    .number("Max edge must be a number")
    .int("Max edge must be a whole number")
    .positive("Max edge must be greater than 0")
    .max(8192, "Max edge cannot exceed 8192"),
})

export type ImageJobInput = z.infer<typeof imageJobSchema>
export type OutputFormat = ImageJobInput["format"]

export type FieldIssue = {
  path: string
  message: string
}

export function fieldIssues(error: z.ZodError): Array<FieldIssue> {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "form",
    message: issue.message,
  }))
}

export function parseImageJob(input: unknown): ImageJobInput {
  return imageJobSchema.parse(input)
}
