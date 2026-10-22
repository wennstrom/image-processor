import { describe, expect, it } from "vitest"

import {
  basenameOf,
  extensionForFormat,
  formatFromMime,
  outputFilename,
} from "@/lib/image/output-file"

describe("output-file", () => {
  it("strips the extension from a filename", () => {
    expect(basenameOf("holiday.photo.png")).toBe("holiday.photo")
  })

  it("maps mime types and builds download names", () => {
    expect(formatFromMime("image/jpeg")).toBe("jpeg")
    expect(extensionForFormat("jpeg")).toBe("jpg")
    expect(outputFilename("photo", "jpeg")).toBe("photo.jpg")
    expect(outputFilename("  ", "png")).toBe("image.png")
  })
})
