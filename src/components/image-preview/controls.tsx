import { useImageContext } from "../image-context"
import { Button } from "../ui/button"

export function ImagePreviewControls() {

  const { showComparison, setShowComparison } = useImageContext()

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex w-1/3 -translate-x-1/2 items-center justify-center rounded-xl bg-background/80 p-2">
      <Button variant="outline" onClick={() => setShowComparison(!showComparison)}>Before / After</Button>
    </div>
  )
}
