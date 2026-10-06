import { describe, expect, it } from "vitest"

import {
  applySourceSize,
  changeDimension,
  ratioOf,
  setKeepRatio,
  type DimensionState,
} from "@/lib/image/aspect-ratio"

const base: DimensionState = {
  width: 200,
  height: 100,
  keepRatio: true,
  lockedRatio: 2,
}

describe("ratioOf", () => {
  it("returns width / height when both are >= 1", () => {
    expect(ratioOf(200, 100)).toBe(2)
  })

  it("returns null when either side is null or < 1", () => {
    expect(ratioOf(null, 100)).toBeNull()
    expect(ratioOf(200, null)).toBeNull()
    expect(ratioOf(0, 100)).toBeNull()
    expect(ratioOf(200, 0)).toBeNull()
  })
})

describe("changeDimension", () => {
  it("only moves the edited side when keepRatio is false", () => {
    const state = { ...base, keepRatio: false }
    expect(changeDimension(state, "width", 300)).toEqual({
      ...state,
      width: 300,
    })
  })

  it("lazy-locks ratio on first edit when lockedRatio is null", () => {
    const state: DimensionState = {
      width: 200,
      height: 100,
      keepRatio: true,
      lockedRatio: null,
    }
    expect(changeDimension(state, "width", 300)).toEqual({
      ...state,
      width: 300,
      lockedRatio: 3,
    })
  })

  it("does not lock when the other side is null", () => {
    const state: DimensionState = {
      width: null,
      height: null,
      keepRatio: true,
      lockedRatio: null,
    }
    expect(changeDimension(state, "width", 300)).toEqual({
      ...state,
      width: 300,
      lockedRatio: null,
    })
  })

  it("follows a locked ratio and never rounds below 1", () => {
    const state: DimensionState = {
      width: 1,
      height: 100,
      keepRatio: true,
      lockedRatio: 0.01,
    }
    expect(changeDimension(state, "width", 1)).toEqual({
      ...state,
      width: 1,
      height: 100,
    })
    // value / lockedRatio would be 1 / 100 = 0.01 → round to 0 → clamp to 1
    const tiny: DimensionState = {
      width: 100,
      height: 1,
      keepRatio: true,
      lockedRatio: 100,
    }
    expect(changeDimension(tiny, "width", 1).height).toBe(1)
  })

  it("leaves the other side and ratio alone when value is null or 0", () => {
    expect(changeDimension(base, "width", null)).toEqual({
      ...base,
      width: null,
    })
    expect(changeDimension(base, "width", 0)).toEqual({
      ...base,
      width: 0,
    })
  })
})

describe("setKeepRatio", () => {
  it("locks from current dims when enabling", () => {
    const state: DimensionState = {
      width: 300,
      height: 150,
      keepRatio: false,
      lockedRatio: null,
    }
    expect(setKeepRatio(state, true)).toEqual({
      ...state,
      keepRatio: true,
      lockedRatio: 2,
    })
  })

  it("clears lockedRatio when disabling", () => {
    expect(setKeepRatio(base, false)).toEqual({
      ...base,
      keepRatio: false,
      lockedRatio: null,
    })
  })
})

describe("applySourceSize", () => {
  it("sets width, height, and lockedRatio for a valid size", () => {
    expect(applySourceSize(base, { width: 640, height: 480 })).toEqual({
      ...base,
      width: 640,
      height: 480,
      lockedRatio: 640 / 480,
    })
  })

  it("returns input unchanged when a dimension is 0", () => {
    expect(applySourceSize(base, { width: 0, height: 480 })).toEqual(base)
  })
})
