/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import Input from '@components/inputs/Input'
import * as yup from 'yup'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import { PublicKey } from '@solana/web3.js'
import Select from '@components/inputs/Select'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import SolendConfiguration from '@tools/sdk/solend/configuration'
import { withdrawObligationCollateralAndRedeemReserveLiquidity } from '@tools/sdk/solend/withdrawObligationCollateralAndRedeemReserveLiquidity'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import {
  UiInstruction,
  WithdrawObligationCollateralAndRedeemReserveLiquidityForm,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../../new'
import SelectOptionList from '../../SelectOptionList'
import { uiAmountToNativeBN } from '@tools/sdk/units'

const WithdrawObligationCollateralAndRedeemReserveLiquidity = ({
  index,
  governanceAccount,
}: {
  index: number
  governanceAccount?: GovernedMultiTypeAccount
}) => {
  const {
    form,
    connection,
    formErrors,
    handleSetForm,
    canSerializeInstruction,
  } = useInstructionFormBuilder<WithdrawObligationCollateralAndRedeemReserveLiquidityForm>(
    {
      initialFormValues: {
        governedAccount: governanceAccount,
        uiAmount: '0',
      },
      schema: yup.object().shape({
        governedAccount: yup
          .object()
          .nullable()
          .required('Governed account is required'),
        mintName: yup.string().required('Token Name is required'),
        uiAmount: yup
          .number()
          .moreThan(0, 'Amount should be more than 0')
          .required('Amount is required'),
      }),
    }
  )
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

    const tx = await withdrawObligationCollateralAndRedeemReserveLiquidity({
      obligationOwner: governanceAccount!.governance.pubkey,
      liquidityAmount: uiAmountToNativeBN(
        form.uiAmount,
        SolendConfiguration.getSupportedMintInformation(form.mintName).decimals
      ),
      mintName: form.mintName,
      ...(form.destinationLiquidity && {
        destinationLiquidity: new PublicKey(form.destinationLiquidity),
      }),
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
        label="Amount to withdraw"
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

      <Input
        label="Destination Account (Optional - default to governance ATA"
        value={form.destinationLiquidity}
        type="string"
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'destinationLiquidity',
          })
        }
        error={formErrors['destinationLiquidity']}
      />
    </>
  )
}

export default WithdrawObligationCollateralAndRedeemReserveLiquidity
