/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import BigNumber from 'bignumber.js'
import { BN } from '@project-serum/anchor'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import SolendConfiguration from '@tools/sdk/solend/configuration'
import { depositReserveLiquidityAndObligationCollateral } from '@tools/sdk/solend/depositReserveLiquidityAndObligationCollateral'
import {
  DepositReserveLiquidityAndObligationCollateralForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../../new'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import { depositReserveLiquidityAndObligationCollateralSchema } from '../../schemas/validationSchemas'
import SelectOptionList from '../../SelectOptionList'
import { GovernedMultiTypeAccount } from '@utils/tokens'

const DepositReserveLiquidityAndObligationCollateral = ({
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
  } = useInstructionFormBuilder<DepositReserveLiquidityAndObligationCollateralForm>(
    {
      initialFormValues: {
        governedAccount: governanceAccount,
        uiAmount: '0',
      },
      schema: depositReserveLiquidityAndObligationCollateralSchema,
    }
  )

  // Hardcoded gate used to be clear about what cluster is supported for now
  if (connection.cluster !== 'mainnet') {
    return <>This instruction does not support {connection.cluster}</>
  }

  const { handleSetInstructions } = useContext(NewProposalContext)

  async function getInstruction(): Promise<UiInstruction> {
    if (!(await canSerializeInstruction()) || !form.mintName) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: governanceAccount?.governance,
      }
    }

    const tx = await depositReserveLiquidityAndObligationCollateral({
      obligationOwner: governanceAccount!.governance.pubkey,
      liquidityAmount: new BN(
        new BigNumber(form.uiAmount)
          .shiftedBy(
            SolendConfiguration.getSupportedMintInformation(form.mintName)
              .decimals
          )
          .toString()
      ),
      mintName: form.mintName,
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
        label="Token Name"
        value={form.mintName}
        placeholder="Please select..."
        onChange={(value) => handleSetForm({ value, propertyName: 'mintName' })}
        error={formErrors['baseTokenName']}
      >
        <SelectOptionList list={SolendConfiguration.getSupportedMintNames()} />
      </Select>

      <Input
        label="Amount to deposit"
        value={form.uiAmount}
        type="string"
        min="0"
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'uiAmount',
          })
        }
        error={formErrors['uiAmount']}
      />
    </>
  )
}

export default DepositReserveLiquidityAndObligationCollateral
