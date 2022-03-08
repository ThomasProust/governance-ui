import yup from 'yup'
import { isFormValid } from '@utils/formValidation'
import { useEffect, useState } from 'react'
import useWalletStore from 'stores/useWalletStore'
import { GovernedMultiTypeAccount } from '@utils/tokens'

function useInstructionFormBuilder<
  T extends {
    governedAccount?: GovernedMultiTypeAccount
  }
>({
  initialFormValues,
  schema,
}: {
  initialFormValues: T
  schema: yup.ObjectSchema<any>
}) {
  const connection = useWalletStore((s) => s.connection)
  const wallet = useWalletStore((s) => s.current)

  const [form, setForm] = useState<T>(initialFormValues)
  const [formErrors, setFormErrors] = useState({})

  const handleSetForm = ({ propertyName, value }) => {
    setFormErrors({})
    setForm({ ...form, [propertyName]: value })
  }

  const validateForm = async (): Promise<boolean> => {
    const { isValid, validationErrors } = await isFormValid(schema, form)
    setFormErrors(validationErrors)
    return isValid
  }

  const canSerializeInstruction = async () => {
    const isValid = await validateForm()

    return (
      isValid && wallet?.publicKey && form.governedAccount?.governance?.account
    )
  }

  useEffect(() => {
    handleSetForm({
      propertyName: 'governedAccount',
      value: initialFormValues.governedAccount,
    })
    validateForm()
  }, [form, initialFormValues.governedAccount])

  return {
    form,
    setForm,
    wallet,
    connection,
    formErrors,
    handleSetForm,
    validateForm,
    canSerializeInstruction,
  }
}

export default useInstructionFormBuilder
