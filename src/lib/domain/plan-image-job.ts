import { Data, Effect } from "effect"

import type { ImageJobInput, OutputFormat } from "@/lib/validation/image-job"

const sourceExtensions = ["jpg", "jpeg", "png", "webp", "gif"] as const

export type SourceExtension = (typeof sourceExtensions)[number]

export class UnknownSource extends Data.TaggedError("UnknownSource")<{
  readonly filename: string
}> {}

export class GifCannotBecomeJpeg extends Data.TaggedError(
  "GifCannotBecomeJpeg"
)<{
  readonly filename: string
}> {}

export class PngTooLarge extends Data.TaggedError("PngTooLarge")<{
  readonly maxEdge: number
  readonly limit: number
}> {}

export type ImageJobError = UnknownSource | GifCannotBecomeJpeg | PngTooLarge

export const pngEdgeLimit = 4096

export type ImagePlan = {
  filename: string
  sourceExtension: SourceExtension
  format: OutputFormat
  maxEdge: number
  steps: Array<"decode" | "resize" | "encode">
}

function extensionOf(filename: string): string | undefined {
  const dot = filename.lastIndexOf(".")
  if (dot <= 0 || dot === filename.length - 1) {
    return undefined
  }
  return filename.slice(dot + 1).toLowerCase()
}

function isSourceExtension(value: string): value is SourceExtension {
  return (sourceExtensions as ReadonlyArray<string>).includes(value)
}

const readSource = (filename: string) => {
  const extension = extensionOf(filename)
  if (extension !== undefined && isSourceExtension(extension)) {
    return Effect.succeed(extension)
  }
  return Effect.fail(new UnknownSource({ filename }))
}

const assertEncodingAllowed = (
  filename: string,
  extension: SourceExtension,
  format: OutputFormat
) => {
  if (extension === "gif" && format === "jpeg") {
    return Effect.fail(new GifCannotBecomeJpeg({ filename }))
  }
  return Effect.void
}

const assertWithinMemoryBudget = (
  extension: SourceExtension,
  maxEdge: number
) => {
  if (extension === "png" && maxEdge > pngEdgeLimit) {
    return Effect.fail(new PngTooLarge({ maxEdge, limit: pngEdgeLimit }))
  }
  return Effect.void
}

export const planImageJob = (
  input: ImageJobInput
): Effect.Effect<ImagePlan, ImageJobError> =>
  Effect.gen(function* () {
    const sourceExtension = yield* readSource(input.filename)
    yield* assertEncodingAllowed(input.filename, sourceExtension, input.format)
    yield* assertWithinMemoryBudget(sourceExtension, input.maxEdge)

    return {
      filename: input.filename,
      sourceExtension,
      format: input.format,
      maxEdge: input.maxEdge,
      steps: ["decode", "resize", "encode"],
    }
  })
