import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import { planImageJob, pngEdgeLimit } from "@/lib/domain/plan-image-job"
import { fieldIssues, imageJobSchema } from "@/lib/validation/image-job"

const validJob = {
  filename: "photo.png",
  format: "webp" as const,
  maxEdge: 800,
}

describe("imageJobSchema", () => {
  it("accepts a plain image filename", () => {
    expect(imageJobSchema.parse(validJob)).toEqual(validJob)
  })

  it("rejects a path in the filename", () => {
    const result = imageJobSchema.safeParse({
      ...validJob,
      filename: "inbox/photo.png",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(fieldIssues(result.error)).toEqual([
        { path: "filename", message: "Filename cannot include a path" },
      ])
    }
  })
})

describe("planImageJob", () => {
  it("plans decode, resize, and encode", () => {
    const plan = Effect.runSync(planImageJob(validJob))

    expect(plan).toMatchObject({
      sourceExtension: "png",
      format: "webp",
      steps: ["decode", "resize", "encode"],
    })
  })

  it("rejects an unknown source extension", () => {
    const exit = Effect.runSyncExit(
      planImageJob({ ...validJob, filename: "notes.txt" })
    )

    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      expect(exit.cause._tag).toBe("Fail")
    }
  })

  it("rejects encoding a gif as jpeg", () => {
    const exit = Effect.runSyncExit(
      planImageJob({
        filename: "anim.gif",
        format: "jpeg",
        maxEdge: 400,
      })
    )

    expect(exit._tag).toBe("Failure")
  })

  it("rejects a png that exceeds the memory budget", () => {
    const exit = Effect.runSyncExit(
      planImageJob({ ...validJob, maxEdge: pngEdgeLimit + 1 })
    )

    expect(exit._tag).toBe("Failure")
  })
})
