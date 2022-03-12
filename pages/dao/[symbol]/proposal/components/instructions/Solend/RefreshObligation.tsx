/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import * as yup from 'yup'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import Select from '@components/inputs/Select'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import SolendConfiguration from '@tools/sdk/solend/configuration'
import { refreshObligation } from '@tools/sdk/solend/refreshObligation'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import {
  RefreshObligationForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../../new'
import SelectOptionList from '../../SelectOptionList'

const RefreshObligation = ({
  index,
  governanceAccount,
}: {
  index: number
  governanceAccount: GovernedMultiTypeAccount | undefined
}) => {
  const {
    form,
    formErrors,
    connection,
    canSerializeInstruction,
    handleSetForm,
  } = useInstructionFormBuilder<RefreshObligationForm>({
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
    if (!form.mintName || !(await canSerializeInstruction())) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: governanceAccount?.governance,
      }
    }

    const tx = await refreshObligation({
      obligationOwner: governanceAccount!.governance.pubkey,
      mintNames: [form.mintName],
    })

    return {
      serializedInstruction: serializeInstructionToBase64(tx),
      isValid: true,
      governance: governanceAccount!.governance,
    }
  }

  useEffect(() => {
    handleSetInstructions(
      {
        governedAccount: governanceAccount?.governance,
        getInstruction,
      },
      index
    )
  }, [form])

  return (
    <>
      <Select
        label="Token Name to refresh obligation for"
        value={form.mintName}
        placeholder="Please select..."
        onChange={(value) => handleSetForm({ value, propertyName: 'mintName' })}
        error={formErrors['baseTokenName']}
      >
        <SelectOptionList list={SolendConfiguration.getSupportedMintNames()} />
      </Select>
    </>
  )
}

export default RefreshObligation
