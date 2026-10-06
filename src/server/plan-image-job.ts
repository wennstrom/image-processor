import { createServerFn } from "@tanstack/react-start"

import { runPlan } from "@/lib/domain/run-plan"
import { parseImageJob } from "@/lib/validation/image-job"

export const planImageJobFn = createServerFn({ method: "POST" })
  .validator(parseImageJob)
  .handler(({ data }) => runPlan(data))
