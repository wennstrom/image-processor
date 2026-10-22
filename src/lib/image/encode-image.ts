import { Data, Effect } from "effect"
import sharp from "sharp"
import type { Sharp } from "sharp"

export class ImageProcessingError extends Data.TaggedError(
  "ImageProcessingError"
)<{
  readonly message: string
}> {}

const toImageError = (cause: unknown) =>
  new ImageProcessingError({
    message: cause instanceof Error ? cause.message : "Image processing failed",
  })

const readMetadata = (image: Sharp) =>
  Effect.tryPromise({
    try: () => image.metadata(),
    catch: toImageError,
  })

const resizeToDpi = (
  image: Sharp,
  dpi: number,
  width: number,
  height: number
) =>
  Effect.tryPromise({
    try: () =>
      image.resize({ width, height }).withMetadata({ density: dpi }).toBuffer(),
    catch: toImageError,
  })

function applyEffects(
  image: Sharp,
  brightness: number,
  contrast: number,
  saturation: number,
  grayscale: boolean,
  sepia: boolean,
  sharpen: boolean,
  vintage: boolean
) {
  let pipeline = image
    .modulate({
      brightness,
      saturation: grayscale ? 0 : saturation,
    })
    .linear(contrast, 128 * (1 - contrast))

  if (grayscale) {
    pipeline = pipeline.grayscale()
  }
  if (sepia) {
    pipeline = pipeline.recomb([
      [0.393, 0.769, 0.189],
      [0.349, 0.686, 0.168],
      [0.272, 0.534, 0.131],
    ])
  }
  if (vintage) {
    pipeline = pipeline
      .modulate({ saturation: 0.7, brightness: 1.05 }) // muted, slightly lifted
      .tint({ r: 255, g: 220, b: 180 }) // warm cast
      .linear(0.9, 20)
  }
  if (sharpen) {
    pipeline = pipeline.sharpen({ sigma: 1.2 })
  }

  return pipeline
}

function encodeFormat(image: Sharp, format: "jpeg" | "png" | "webp") {
  switch (format) {
    case "jpeg":
      return image.jpeg()
    case "png":
      return image.png()
    case "webp":
      return image.webp()
  }
}

export const resampleToDpi = (
  input: Buffer,
  dpi: number
): Effect.Effect<Buffer, ImageProcessingError> =>
  Effect.gen(function* () {
    const image = sharp(input)
    const metadata = yield* readMetadata(image)
    const sourceDpi = metadata.density ?? 72

    if (sourceDpi === dpi) {
      return input
    }

    const scale = dpi / sourceDpi
    const width = Math.round(metadata.width * scale)
    const height = Math.round(metadata.height * scale)

    if (width === 0 || height === 0) {
      return yield* Effect.fail(
        new ImageProcessingError({ message: "Image has no pixel dimensions" })
      )
    }

    return yield* resizeToDpi(image, dpi, width, height)
  })

export const processImage = (
  input: Buffer,
  {
    dpi,
    width,
    height,
    format,
    brightness,
    contrast,
    saturation,
    grayscale,
    sepia,
    sharpen,
    vintage,
  }: {
    dpi: number
    width: number
    height: number
    format: "jpeg" | "png" | "webp"
    brightness: number
    contrast: number
    saturation: number
    grayscale: boolean
    sepia: boolean
    sharpen: boolean
    vintage: boolean
  }
): Effect.Effect<Buffer, ImageProcessingError> =>
  Effect.tryPromise({
    try: () =>
      encodeFormat(
        applyEffects(
          sharp(input).resize({ width, height }),
          brightness / 100,
          contrast / 100,
          saturation / 100,
          grayscale,
          sepia,
          sharpen,
          vintage
        ),
        format
      )
        .withDensity(dpi)
        .toBuffer(),
    catch: toImageError,
  })
