/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import * as yup from 'yup'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import Select from '@components/inputs/Select'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import SolendConfiguration from '@tools/sdk/solend/configuration'
import { refreshReserve } from '@tools/sdk/solend/refreshReserve'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import {
  RefreshReserveForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../../new'

const RefreshReserve = ({
  index,
  governanceAccount,
}: {
  index: number
  governanceAccount: GovernedMultiTypeAccount | undefined
}) => {
  const {
    form,
    connection,
    formErrors,
    handleSetForm,
    canSerializeInstruction,
  } = useInstructionFormBuilder<RefreshReserveForm>({
    initialFormValues: {
      governedAccount: governanceAccount,
    },
    schema: yup.object().shape({
      governedAccount: yup
        .object()
        .nullable()
        .required('Governed account is required'),
      mintName: yup.string().required('Token Name is required'),
    }),
  })

  const { handleSetInstructions } = useContext(NewProposalContext)

  // Hardcoded gate used to be clear about what cluster is supported for now
  if (connection.cluster !== 'mainnet') {
    return <>This instruction does not support {connection.cluster}</>
  }

  async function getInstruction(): Promise<UiInstruction> {
    if (!(await canSerializeInstruction()) || !form.mintName) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: form.governedAccount?.governance,
      }
    }

    const tx = await refreshReserve({
      mintName: form.mintName,
    })

    return {
      serializedInstruction: serializeInstructionToBase64(tx),
      isValid: true,
      governance: governanceAccount?.governance,
    }
  }

  useEffect(() => {
    handleSetInstructions(
      {
        governedAccount: form.governedAccount?.governance,
        getInstruction,
      },
      index
    )
  }, [form])

  return (
    <>
      <Select
        label="Token Name to refresh reserve for"
        value={form.mintName}
        placeholder="Please select..."
        onChange={(value) => handleSetForm({ value, propertyName: 'mintName' })}
        error={formErrors['baseTokenName']}
      >
        {SolendConfiguration.getSupportedMintNames().map((value) => (
          <Select.Option key={value} value={value}>
            {value}
          </Select.Option>
        ))}
      </Select>
    </>
  )
}

export default RefreshReserve
