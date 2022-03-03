import { isFormValid } from '@utils/formValidation'
import { useEffect, useState } from 'react'
import useWalletStore from 'stores/useWalletStore'
import useRealm from './useRealm'

const useInstructionFormBuilder = (
  form: any,
  handleFormChange: (newForm: any) => void
) => {
  const connection = useWalletStore((s) => s.connection)
  const wallet = useWalletStore((s) => s.current)
  const [formErrors, setFormErrors] = useState({})

  const { realmInfo } = useRealm()

  const programId = realmInfo?.programId

  const handleSetForm = ({ propertyName, value }) => {
    setFormErrors({})
    handleFormChange({ ...form, [propertyName]: value })
  }

  const validateForm = async (schema, form): Promise<boolean> => {
    const { isValid, validationErrors } = await isFormValid(schema, form)
    setFormErrors(validationErrors)
    return isValid
  }

  const canSerializeInstruction = async ({
    form,
    schema,
  }: {
    form: any
    schema: any
  }) => {
    const isValid = await validateForm(schema, form)
    return (
      isValid &&
      programId &&
      wallet?.publicKey &&
      form.governedAccount?.governance?.account
    )
  }

  useEffect(() => {
    handleSetForm({
      propertyName: 'programId',
      value: programId?.toString(),
    })
  }, [realmInfo?.programId])

  return {
    wallet,
    connection,
    programId,
    formErrors,
    handleSetForm,
    validateForm,
    canSerializeInstruction,
  }
}

export default useInstructionFormBuilder
