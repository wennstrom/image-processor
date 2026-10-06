import { imageProcessFormData } from "@/lib/image/image-request"
import type { ImageFormSubmitValues } from "@/lib/validation/image-form"
import { processImageFn } from "@/server/image"

export function fileFromResponse(
  response: Response,
  bytes: ArrayBuffer,
  source: File
): File {
  return new File([bytes], source.name, {
    type: response.headers.get("content-type") ?? source.type,
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
    brightness: values.brightness,
    contrast: values.contrast,
    saturation: values.saturation,
    grayscale: values.grayscale,
  })
  const response = await processImageFn({ data: body })
  const bytes = await response.arrayBuffer()
  return fileFromResponse(response, bytes, image)
}
