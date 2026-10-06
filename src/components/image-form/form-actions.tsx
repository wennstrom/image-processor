import { useImageContext } from "@/components/image-context"
import { Button } from "@/components/ui/button"
import { downloadFile } from "@/lib/download-file"

export function FormActions({
  pending,
  canSubmit,
  submitError,
}: {
  pending: boolean
  canSubmit: boolean
  submitError: string | null
}) {
  const { image, processedImage } = useImageContext()
  const downloadable = processedImage ?? image

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-row gap-2">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? "Processing…" : "Process image"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!downloadable}
          onClick={() => {
            if (downloadable) downloadFile(downloadable)
          }}
        >
          Download Image
        </Button>
      </div>
      {submitError ? (
        <p className="text-xs text-destructive">{submitError}</p>
      ) : null}
    </div>
  )
}
