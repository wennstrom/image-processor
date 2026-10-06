import { Data, Effect } from "effect"
import sharp, { type Sharp } from "sharp"

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

const resizeToDimensions = (image: Sharp, width: number, height: number) =>
  Effect.tryPromise({
    try: () => image.resize({ width, height }).toBuffer(),
    catch: toImageError,
  })

const addEffects = (
  image: Sharp,
  brightness: number,
  contrast: number,
  saturation: number,
  grayscale: boolean
) =>
  Effect.tryPromise({
    try: () => {
      const adjusted = image
        .modulate({
          brightness,
          saturation: grayscale ? 0 : saturation,
        })
        .linear(contrast, 128 * (1 - contrast))

      return (grayscale ? adjusted.grayscale() : adjusted).toBuffer()
    },
    catch: toImageError,
  })

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
    const width = Math.round((metadata.width ?? 0) * scale)
    const height = Math.round((metadata.height ?? 0) * scale)

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
    brightness,
    contrast,
    saturation,
    grayscale,
  }: {
    dpi: number
    width: number
    height: number
    brightness: number
    contrast: number
    saturation: number
    grayscale: boolean
  }
): Effect.Effect<Buffer, ImageProcessingError> =>
  Effect.gen(function* () {
    const resized = yield* resizeToDimensions(sharp(input), width, height)
    const resampled = yield* resampleToDpi(resized, dpi)

    return yield* addEffects(
      sharp(resampled),
      brightness / 100,
      contrast / 100,
      saturation / 100,
      grayscale
    )
  })
