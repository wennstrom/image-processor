import { describe, expect, it } from "vitest"

import { fileFromResponse } from "@/lib/image/process-image-job"

describe("fileFromResponse", () => {
  it("uses the output name and prefers the response content-type", () => {
    const response = new Response(null, {
      headers: { "content-type": "image/webp" },
    })
    const file = fileFromResponse(
      response,
      new Uint8Array([9]).buffer,
      "photo.webp",
      "image/png"
    )
    expect(file.name).toBe("photo.webp")
    expect(file.type).toBe("image/webp")
  })

  it("falls back to the provided type when the header is missing", () => {
    const response = new Response(null)
    const file = fileFromResponse(
      response,
      new Uint8Array([9]).buffer,
      "photo.jpg",
      "image/jpeg"
    )
    expect(file.type).toBe("image/jpeg")
  })
})
