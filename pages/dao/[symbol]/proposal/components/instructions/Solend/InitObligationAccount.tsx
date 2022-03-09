/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import * as yup from 'yup'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import { initObligationAccount } from '@tools/sdk/solend/initObligationAccount'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import {
  InitSolendObligationAccountForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../../new'

const InitObligationAccount = ({
  index,
  governanceAccount,
}: {
  index: number
  governanceAccount: GovernedMultiTypeAccount | undefined
}) => {
  const {
    form,
    connection,
    canSerializeInstruction,
  } = useInstructionFormBuilder<InitSolendObligationAccountForm>({
    initialFormValues: {
      governedAccount: governanceAccount,
    },
    schema: yup.object().shape({
      governedAccount: yup
        .object()
        .nullable()
        .required('Governed account is required'),
    }),
  })

  // Hardcoded gate used to be clear about what cluster is supported for now
  if (connection.cluster !== 'mainnet') {
    return <>This instruction does not support {connection.cluster}</>
  }

  const { handleSetInstructions } = useContext(NewProposalContext)

  async function getInstruction(): Promise<UiInstruction> {
    if (!(await canSerializeInstruction())) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: governanceAccount?.governance,
      }
    }

    const tx = await initObligationAccount({
      obligationOwner: governanceAccount!.governance.pubkey,
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

  return null
}

export default InitObligationAccount
