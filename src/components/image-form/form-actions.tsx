import { useImageContext } from "@/components/image-context"
import { Button } from "@/components/ui/button"
import { downloadFile } from "@/lib/download-file"
import { useFormContext } from "@/lib/form/form-context"
import { outputFilename } from "@/lib/image/output-file"

export function FormActions({
  canReset,
  submitError,
  onReset,
}: {
  canReset: boolean
  submitError: string | null
  onReset: () => void
}) {
  const form = useFormContext()
  const { image, processedImage } = useImageContext()
  const downloadable = processedImage ?? image

  return (
    <form.Subscribe
      selector={(s) => ({
        pending: s.isSubmitting,
        name: s.values.name,
        format: s.values.format,
      })}
    >
      {({ pending, name, format }) => (
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-row items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canReset || pending}
              onClick={onReset}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!downloadable}
              onClick={() => {
                if (!downloadable) return
                downloadFile(
                  new File([downloadable], outputFilename(name, format), {
                    type: downloadable.type,
                  })
                )
              }}
            >
              Download Image
            </Button>
            {pending ? (
              <p className="text-xs text-muted-foreground">Processing…</p>
            ) : null}
          </div>
          {submitError ? (
            <p className="text-xs text-destructive">{submitError}</p>
          ) : null}
        </div>
      )}
    </form.Subscribe>
  )
}
