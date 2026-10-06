import {
  CheckboxField,
  DimensionField,
  PercentSliderField,
  ResolutionField,
} from "@/components/image-form/fields"
import { FormActions } from "@/components/image-form/form-actions"
import { ImageDropzone } from "@/components/image-form/image-dropzone"
import { useImageJobForm } from "@/components/image-form/use-image-job-form"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { adjustments, effects } from "@/lib/validation/image-form"
import { cn } from "cn"

export function ImageJobForm({ className }: { className?: string }) {
  const {
    form,
    image,
    imageError,
    submitError,
    acceptImage,
    changeDimension,
    toggleKeepRatio,
  } = useImageJobForm()

  return (
    <Card size="sm" className={cn("h-full min-h-0", className)}>
      <CardHeader className="shrink-0">
        <CardTitle>Processing Options</CardTitle>
      </CardHeader>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <ImageDropzone
            file={image}
            error={imageError ?? undefined}
            inputId="image"
            onFile={(file) => {
              void acceptImage(file)
            }}
          />

          <fieldset className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <form.Field name="width">
                {(field) => (
                  <DimensionField
                    field={field}
                    label="Width (px)"
                    onChange={(value) => changeDimension("width", value)}
                  />
                )}
              </form.Field>
              <form.Field name="height">
                {(field) => (
                  <DimensionField
                    field={field}
                    label="Height (px)"
                    onChange={(value) => changeDimension("height", value)}
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="keepRatio">
              {(field) => (
                <CheckboxField
                  field={field}
                  label="Keep ratio"
                  onChange={toggleKeepRatio}
                />
              )}
            </form.Field>
          </fieldset>

          <form.Field name="resolution">
            {(field) => <ResolutionField field={field} />}
          </form.Field>

          {adjustments.map((adjustment) => (
            <form.Field key={adjustment.name} name={adjustment.name}>
              {(field) => (
                <PercentSliderField field={field} label={adjustment.label} />
              )}
            </form.Field>
          ))}

          <div className="grid grid-cols-2 gap-2">
            {effects.map((effect) => (
              <form.Field key={effect.name} name={effect.name}>
                {(field) => (
                  <CheckboxField field={field} label={effect.label} />
                )}
              </form.Field>
            ))}
          </div>
        </CardContent>

        <CardFooter className="shrink-0 flex-row gap-2">
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <FormActions
                pending={isSubmitting}
                canSubmit={image !== null}
                submitError={submitError}
              />
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  )
}
