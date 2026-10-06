export type DimensionState = {
  width: number | null
  height: number | null
  keepRatio: boolean
  lockedRatio: number | null
}

export function ratioOf(
  width: number | null,
  height: number | null
): number | null {
  if (width === null || height === null || width < 1 || height < 1) {
    return null
  }
  return width / height
}

export function changeDimension(
  state: DimensionState,
  side: "width" | "height",
  value: number | null
): DimensionState {
  const next: DimensionState = { ...state, [side]: value }

  if (!state.keepRatio || value === null || value < 1) {
    return next
  }

  if (state.lockedRatio === null) {
    return {
      ...next,
      lockedRatio: ratioOf(next.width, next.height),
    }
  }

  const lockedRatio = state.lockedRatio
  if (side === "width") {
    return {
      ...next,
      height: Math.max(1, Math.round(value / lockedRatio)),
    }
  }
  return {
    ...next,
    width: Math.max(1, Math.round(value * lockedRatio)),
  }
}

export function setKeepRatio(
  state: DimensionState,
  keepRatio: boolean
): DimensionState {
  if (!keepRatio) {
    return { ...state, keepRatio: false, lockedRatio: null }
  }
  return {
    ...state,
    keepRatio: true,
    lockedRatio: ratioOf(state.width, state.height),
  }
}

export function applySourceSize(
  state: DimensionState,
  size: { width: number; height: number }
): DimensionState {
  if (size.width < 1 || size.height < 1) return state
  return {
    ...state,
    width: size.width,
    height: size.height,
    lockedRatio: size.width / size.height,
  }
}
