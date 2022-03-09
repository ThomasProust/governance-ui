/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import * as yup from 'yup'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import Select from '@components/inputs/Select'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import { createAssociatedTokenAccount } from '@utils/associated'
import { getSplTokenMintAddressByUIName, SPL_TOKENS } from '@utils/splTokens'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import {
  CreateAssociatedTokenAccountForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../new'

const CreateAssociatedTokenAccount = ({
  index,
  governanceAccount,
}: {
  index: number
  governanceAccount: GovernedMultiTypeAccount | undefined
}) => {
  const {
    wallet,
    form,
    formErrors,
    handleSetForm,
    canSerializeInstruction,
  } = useInstructionFormBuilder<CreateAssociatedTokenAccountForm>({
    initialFormValues: {
      governedAccount: governanceAccount,
    },
    schema: yup.object().shape({
      governedAccount: yup
        .object()
        .nullable()
        .required('Governed account is required'),
      splTokenMintUIName: yup.string().required('SPL Token Mint is required'),
    }),
  })

  const { handleSetInstructions } = useContext(NewProposalContext)

  async function getInstruction(): Promise<UiInstruction> {
    if (
      !(await canSerializeInstruction()) ||
      !form.splTokenMintUIName ||
      !wallet?.publicKey
    ) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: governanceAccount?.governance,
      }
    }

    const [tx] = await createAssociatedTokenAccount(
      // fundingAddress
      wallet.publicKey,

      // walletAddress
      governanceAccount!.governance.pubkey,

      // splTokenMintAddress
      getSplTokenMintAddressByUIName(form.splTokenMintUIName)
    )

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
        label="SPL Token Mint"
        value={form.splTokenMintUIName}
        placeholder="Please select..."
        onChange={(value) =>
          handleSetForm({ value, propertyName: 'splTokenMintUIName' })
        }
        error={formErrors['baseTokenName']}
      >
        {Object.entries(SPL_TOKENS).map(([key, { name, mint }]) => (
          <Select.Option key={key} value={name}>
            <div className="flex flex-col">
              <span>{name}</span>

              <span className="text-gray-500 text-sm">{mint.toString()}</span>
            </div>
          </Select.Option>
        ))}
      </Select>
    </>
  )
}

export default CreateAssociatedTokenAccount
