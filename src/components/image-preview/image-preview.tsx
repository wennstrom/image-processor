import ReactCompareImage from "react-compare-image"
import { Card } from "../ui/card"
import { useImageContext } from "@/components/image-context"
import { ImagePreviewControls } from "./controls"

export function ImagePreview() {
  const { image, processedImage, showComparison } = useImageContext()
  const previewSource = processedImage ?? image
  const previewUrl = previewSource
    ? URL.createObjectURL(previewSource)
    : null
  const imageUrl = image ? URL.createObjectURL(image) : null
  const processedImageUrl = processedImage
    ? URL.createObjectURL(processedImage)
    : null

  return (
    <Card className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {previewUrl ? (
        <>
          {showComparison && imageUrl && processedImageUrl ? (
            <div className="absolute inset-0 flex items-center justify-center p-2">
              <div className="relative max-h-full max-w-full min-h-0">
                <img
                  src={imageUrl}
                  alt=""
                  aria-hidden
                  className="block max-h-full max-w-full opacity-0"
                />
                <div className="absolute inset-0">
                  <ReactCompareImage
                    leftImage={imageUrl}
                    rightImage={processedImageUrl}
                  />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt="Selected image"
              className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-2"
            />
          )}
          <ImagePreviewControls />
        </>
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-sm text-muted-foreground">
          <p>No image selected</p>
        </div>
      )}
    </Card>
  )
}
