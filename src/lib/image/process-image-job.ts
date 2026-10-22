import { imageProcessFormData } from "@/lib/image/image-request"
import { mimeForFormat, outputFilename } from "@/lib/image/output-file"
import type { ImageFormSubmitValues } from "@/lib/validation/image-form"
import { processImageFn } from "@/server/image"

export function fileFromResponse(
  response: Response,
  bytes: ArrayBuffer,
  outputName: string,
  fallbackType: string
): File {
  return new File([bytes], outputName, {
    type: response.headers.get("content-type") ?? fallbackType,
  })
}

export async function processImageJob(
  image: File,
  values: ImageFormSubmitValues
): Promise<File> {
  const body = imageProcessFormData({
    image,
    resolution: values.resolution,
    width: values.width,
    height: values.height,
    format: values.format,
    brightness: values.brightness,
    contrast: values.contrast,
    saturation: values.saturation,
    grayscale: values.grayscale,
    sepia: values.sepia,
    sharpen: values.sharpen,
    vintage: values.vintage,
  })
  const response = await processImageFn({ data: body })
  const bytes = await response.arrayBuffer()
  return fileFromResponse(
    response,
    bytes,
    outputFilename(values.name, values.format),
    mimeForFormat(values.format)
  )
}
