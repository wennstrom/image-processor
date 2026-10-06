import { Card } from "./ui/card"
import { useImageContext } from "@/components/image-context"

export function ImagePreview() {
  const { image, processedImage } = useImageContext()
  const previewSource = processedImage ?? image
  const previewUrl = previewSource
    ? URL.createObjectURL(previewSource)
    : null

  return (
    <Card className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Selected image"
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-sm text-muted-foreground">
          <p>No image selected</p>
        </div>
      )}
    </Card>
  )
}
