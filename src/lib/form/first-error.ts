export function firstError(
  errors: ReadonlyArray<unknown>
): string | undefined {
  const first = errors[0]
  if (typeof first === "string") return first
  if (
    first &&
    typeof first === "object" &&
    "message" in first &&
    typeof first.message === "string"
  ) {
    return first.message
  }
  return undefined
}
