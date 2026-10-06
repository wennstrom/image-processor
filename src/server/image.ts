import { createServerFn } from "@tanstack/react-start"
import { Effect } from "effect"
import { z } from "zod"

import { processImage, resampleToDpi } from "@/lib/image/encode-image"
import { parseImageRequest } from "@/lib/image/image-request"
import type { Resolution } from "@/lib/validation/image-form"
import { resolutions } from "@/lib/validation/image-form"

const allowedDpi = new Set<number>(resolutions)

const resampleRequestSchema = z.object({
  image: z.instanceof(File, { message: "Upload an image" }),
  dpi: z.custom<Resolution>(
    (value) => typeof value === "number" && allowedDpi.has(value),
    "Resolution must be 72, 150, or 300 dpi"
  ),
})

function parseResampleRequest(data: FormData) {
  if (!(data instanceof FormData)) {
    throw new Error("Expected form data")
  }

  return resampleRequestSchema.parse({
    image: data.get("image"),
    dpi: Number(data.get("dpi")),
  })
}

async function bytesFromFile(file: File) {
  return Buffer.from(await file.arrayBuffer())
}

function imageResponse(bytes: Buffer, type: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": type || "application/octet-stream",
    },
  })
}

export const resampleImageFn = createServerFn({ method: "POST" })
  .validator(parseResampleRequest)
  .handler(async ({ data }) => {
    const input = await bytesFromFile(data.image)
    const output = await Effect.runPromise(resampleToDpi(input, data.dpi))
    return imageResponse(output, data.image.type)
  })

export const processImageFn = createServerFn({ method: "POST" })
  .validator(parseImageRequest)
  .handler(async ({ data }) => {
    const input = await bytesFromFile(data.image)
    const output = await Effect.runPromise(processImage(input, data))
    return imageResponse(output, data.image.type)
  })
