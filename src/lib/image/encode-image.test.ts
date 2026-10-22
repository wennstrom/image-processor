import { Effect } from "effect"
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { processImage } from "@/lib/image/encode-image"

const neutral = {
  dpi: 72,
  width: 4,
  height: 2,
  format: "png" as const,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: false,
  sepia: false,
  sharpen: false,
  vintage: false,
}

async function twoTonePng() {
  const width = 4
  const height = 2
  const raw = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3
      const value = x < width / 2 ? 64 : 192
      raw[offset] = x < width / 2 ? 200 : value
      raw[offset + 1] = value
      raw[offset + 2] = x < width / 2 ? 40 : value
    }
  }

  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer()
}

async function channelStats(bytes: Buffer) {
  const { data, info } = await sharp(bytes)
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = info.channels
  let min = 255
  let max = 0
  let colorGap = 0
  let total = 0
  const pixels = data.length / channels

  for (let index = 0; index < data.length; index += channels) {
    const red = data[index] ?? 0
    const green = data[index + 1] ?? 0
    const blue = data[index + 2] ?? 0
    min = Math.min(min, red, green, blue)
    max = Math.max(max, red, green, blue)
    colorGap = Math.max(
      colorGap,
      Math.abs(red - green),
      Math.abs(green - blue),
      Math.abs(red - blue)
    )
    total += red + green + blue
  }

  return { min, max, spread: max - min, colorGap, mean: total / (pixels * 3) }
}

async function processed(input: Buffer, options: Partial<typeof neutral> = {}) {
  return Effect.runPromise(processImage(input, { ...neutral, ...options }))
}

describe("processImage", () => {
  it("stores dpi on the requested pixel size", async () => {
    const input = await twoTonePng()
    const output = await processed(input, { dpi: 300, width: 4, height: 2 })
    const metadata = await sharp(output).metadata()

    expect(metadata.width).toBe(4)
    expect(metadata.height).toBe(2)
    expect(metadata.density).toBe(300)
  })

  it("darkens pixels when brightness is below neutral", async () => {
    const input = await twoTonePng()
    const original = await channelStats(await processed(input))
    const darkened = await channelStats(
      await processed(input, { brightness: 0 })
    )

    expect(darkened.mean).toBeLessThan(original.mean)
  })

  it("widens the tonal range when contrast is above neutral", async () => {
    const input = await twoTonePng()
    const original = await channelStats(await processed(input))
    const contrasted = await channelStats(
      await processed(input, { contrast: 200 })
    )

    expect(contrasted.spread).toBeGreaterThan(original.spread)
  })

  it("removes color when saturation is zero", async () => {
    const input = await twoTonePng()
    const desaturated = await channelStats(
      await processed(input, { saturation: 0 })
    )

    expect(desaturated.colorGap).toBe(0)
  })

  it("removes color when grayscale is enabled", async () => {
    const input = await twoTonePng()
    const gray = await channelStats(
      await processed(input, { saturation: 200, grayscale: true })
    )

    expect(gray.colorGap).toBe(0)
  })
})
