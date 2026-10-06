import { Upload } from "lucide-react"
import { useRef, useState } from "react"
import type { DragEvent } from "react"

import { Button } from "@/components/ui/button"
import { imageTypes } from "@/lib/validation/image-form"
import { cn } from "cn"

export function ImageDropzone({
  file,
  error,
  inputId,
  onFile,
}: {
  file: File | null
  error?: string
  inputId: string
  onFile: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    onFile(event.dataTransfer.files.item(0))
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-invalid={error !== undefined}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg border border-dashed border-input px-3 py-1.5 transition-colors",
          dragging && "border-foreground bg-muted",
          error && "border-destructive"
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          name={inputId}
          type="file"
          accept={imageTypes.join(",")}
          className="sr-only"
          onChange={(event) => {
            onFile(event.target.files?.[0] ?? null)
            event.target.value = ""
          }}
        />
        {file ? (
          <div className="flex w-full items-center justify-between gap-2">
            <p className="truncate text-sm">{file.name}</p>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onFile(null)}
              >
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer items-center gap-2"
          >
            <Upload className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-left">
              <span className="block text-sm font-medium">
                Drop an image, or browse
              </span>
              <span className="block text-xs text-muted-foreground">
                JPEG, PNG, WebP, or GIF
              </span>
            </span>
          </label>
        )}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
