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
    resetToOriginal,
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
        }}
      >
        <form.AppForm>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            <ImageDropzone
              file={image}
              error={imageError ?? undefined}
              inputId="image"
              onFile={(file) => {
                void acceptImage(file)
              }}
            />

            <form.Subscribe selector={(s) => s.values.format}>
              {(format) => (
                <form.AppField name="name">
                  {(field) => <field.NameField format={format} />}
                </form.AppField>
              )}
            </form.Subscribe>

            <form.AppField name="format">
              {(field) => <field.FormatField />}
            </form.AppField>

            <fieldset className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <form.AppField name="width">
                  {(field) => (
                    <field.DimensionField
                      label="Width (px)"
                      onChange={(value) => changeDimension("width", value)}
                    />
                  )}
                </form.AppField>
                <form.AppField name="height">
                  {(field) => (
                    <field.DimensionField
                      label="Height (px)"
                      onChange={(value) => changeDimension("height", value)}
                    />
                  )}
                </form.AppField>
              </div>
              <form.AppField name="keepRatio">
                {(field) => (
                  <field.CheckboxField
                    label="Keep ratio"
                    onChange={toggleKeepRatio}
                  />
                )}
              </form.AppField>
            </fieldset>

            <form.AppField name="resolution">
              {(field) => <field.ResolutionField />}
            </form.AppField>

            {adjustments.map((adjustment) => (
              <form.AppField key={adjustment.name} name={adjustment.name}>
                {(field) => (
                  <field.PercentSliderField label={adjustment.label} />
                )}
              </form.AppField>
            ))}

            <div className="grid grid-cols-2 gap-2">
              {effects.map((effect) => (
                <form.AppField key={effect.name} name={effect.name}>
                  {(field) => <field.CheckboxField label={effect.label} />}
                </form.AppField>
              ))}
            </div>
          </CardContent>

          <CardFooter className="shrink-0 flex-row gap-2">
            <form.FormActions
              canReset={image !== null}
              submitError={submitError}
              onReset={() => {
                void resetToOriginal()
              }}
            />
          </CardFooter>
        </form.AppForm>
      </form>
    </Card>
  )
}
