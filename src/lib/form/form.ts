import { createFormHook } from "@tanstack/react-form"

import {
  CheckboxField,
  DimensionField,
  FormatField,
  NameField,
  PercentSliderField,
  ResolutionField,
} from "@/components/image-form/fields"
import { FormActions } from "@/components/image-form/form-actions"
import { fieldContext, formContext } from "@/lib/form/form-context"

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    NameField,
    FormatField,
    DimensionField,
    PercentSliderField,
    CheckboxField,
    ResolutionField,
  },
  formComponents: {
    FormActions,
  },
})
