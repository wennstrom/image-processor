import type { OutputFormat } from "@/lib/validation/image-form"

export function basenameOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return base
  return base.slice(0, dot)
}

export function formatFromMime(mime: string): OutputFormat | null {
  switch (mime) {
    case "image/jpeg":
      return "jpeg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    default:
      return null
  }
}

export function mimeForFormat(format: OutputFormat): string {
  switch (format) {
    case "jpeg":
      return "image/jpeg"
    case "png":
      return "image/png"
    case "webp":
      return "image/webp"
  }
}

export function extensionForFormat(format: OutputFormat): string {
  switch (format) {
    case "jpeg":
      return "jpg"
    case "png":
      return "png"
    case "webp":
      return "webp"
  }
}

export function outputFilename(basename: string, format: OutputFormat): string {
  const trimmed = basename.trim()
  const name = trimmed.length > 0 ? trimmed : "image"
  return `${name}.${extensionForFormat(format)}`
}
