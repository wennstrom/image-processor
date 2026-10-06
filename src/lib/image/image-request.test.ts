import { describe, expect, it } from "vitest"

import {
  imageProcessFormData,
  parseImageRequest,
} from "@/lib/image/image-request"

describe("image process request", () => {
  it("keeps dimensions, resolution, and effects from the form", () => {
    const image = new File([new Uint8Array([1, 2, 3])], "photo.png", {
      type: "image/png",
    })
    const body = imageProcessFormData({
      image,
      resolution: 150,
      width: 640,
      height: 480,
      brightness: 40,
      contrast: 160,
      saturation: 20,
      grayscale: true,
      sepia: true,
      sharpen: false,
      vintage: true,
    })

    expect(parseImageRequest(body)).toMatchObject({
      image,
      dpi: 150,
      width: 640,
      height: 480,
      brightness: 40,
      contrast: 160,
      saturation: 20,
      grayscale: true,
      sepia: true,
      sharpen: false,
      vintage: true,
    })
  })
})
