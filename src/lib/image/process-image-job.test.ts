import { describe, expect, it } from "vitest"

import { fileFromResponse } from "@/lib/image/process-image-job"

describe("fileFromResponse", () => {
  const source = new File([new Uint8Array([1])], "photo.png", {
    type: "image/png",
  })

  it("uses the source name and prefers the response content-type", () => {
    const response = new Response(null, {
      headers: { "content-type": "image/webp" },
    })
    const file = fileFromResponse(response, new Uint8Array([9]).buffer, source)
    expect(file.name).toBe("photo.png")
    expect(file.type).toBe("image/webp")
  })

  it("falls back to the source type when the header is missing", () => {
    const response = new Response(null)
    const file = fileFromResponse(response, new Uint8Array([9]).buffer, source)
    expect(file.type).toBe("image/png")
  })
})
