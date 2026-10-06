import { Effect } from "effect"

import { planImageJob } from "@/lib/domain/plan-image-job"
import type { ImagePlan } from "@/lib/domain/plan-image-job"
import type { ImageJobInput } from "@/lib/validation/image-job"

export type PlanJobResult =
  { ok: true; plan: ImagePlan } | { ok: false; message: string }

const rejected = (message: string): PlanJobResult => ({
  ok: false,
  message,
})

export function runPlan(input: ImageJobInput): Promise<PlanJobResult> {
  return Effect.runPromise(
    planImageJob(input).pipe(
      Effect.map((plan): PlanJobResult => ({ ok: true, plan })),
      Effect.catchTags({
        UnknownSource: (error) =>
          Effect.succeed(
            rejected(
              `"${error.filename}" needs an image extension such as png, jpg, webp, or gif.`
            )
          ),
        GifCannotBecomeJpeg: () =>
          Effect.succeed(rejected("GIF sources cannot be encoded as JPEG.")),
        PngTooLarge: (error) =>
          Effect.succeed(
            rejected(
              `PNG sources cannot exceed ${error.limit}px on the longest edge.`
            )
          ),
      })
    )
  )
}
