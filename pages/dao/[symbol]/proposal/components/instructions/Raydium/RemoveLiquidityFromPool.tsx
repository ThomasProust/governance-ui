/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect, useState } from 'react'
import * as yup from 'yup'
import { jsonInfo2PoolKeys } from '@raydium-io/raydium-sdk'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import { PublicKey } from '@solana/web3.js'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import { createRemoveLiquidityInstruction } from '@tools/sdk/raydium/createRemoveLiquidityInstruction'
import { fetchLiquidityPoolData } from '@tools/sdk/raydium/helpers'
import { liquidityPoolKeysList } from '@tools/sdk/raydium/poolKeys'
import { notify } from '@utils/notifications'
import {
  RemoveLiquidityRaydiumForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'

import { NewProposalContext } from '../../../new'
import SelectOptionList from '../../SelectOptionList'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import { uiAmountToNativeBN } from '@tools/sdk/units'

const RemoveLiquidityFromPool = ({
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
    canSerializeInstruction,
    handleSetForm,
  } = useInstructionFormBuilder<RemoveLiquidityRaydiumForm>({
    initialFormValues: {
      governedAccount: governanceAccount,
      liquidityPool: '',
      amountIn: 0,
    },
    schema: yup.object().shape({
      governedAccount: yup
        .object()
        .nullable()
        .required('Program governed account is required'),
      liquidityPool: yup.string().required('Liquidity Pool is required'),
      amountIn: yup
        .number()
        .moreThan(0, 'Amount for LP token should be more than 0')
        .required('Amount for LP token is required'),
    }),
  })

  const { handleSetInstructions } = useContext(NewProposalContext)

  const [lpMintInfo, setLpMintInfo] = useState<{
    balance: number
    decimals: number
  } | null>(null)

  useEffect(() => {
    async function fetchLpMintInfo() {
      try {
        const { maxBalance, decimals } = await fetchLiquidityPoolData({
          governanceKey: governanceAccount?.governance.pubkey,
          lp: form.liquidityPool,
          connection,
        })
        setLpMintInfo({ balance: maxBalance, decimals })
      } catch (e) {
        notify({
          type: 'error',
          message: 'Could not fetch LP Account',
          description: `${form.liquidityPool} LP Token Account could not be found for the selected Governance`,
        })
      }
    }
    fetchLpMintInfo()
  }, [governanceAccount?.governance.pubkey, form.liquidityPool])

  async function getInstruction(): Promise<UiInstruction> {
    if (
      !form.liquidityPool ||
      !lpMintInfo ||
      !(await canSerializeInstruction())
    ) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: governanceAccount?.governance,
      }
    }
    const createIx = createRemoveLiquidityInstruction(
      new PublicKey(governanceAccount!.governance.pubkey),
      jsonInfo2PoolKeys(liquidityPoolKeysList[form.liquidityPool]),
      uiAmountToNativeBN(form.amountIn, lpMintInfo.decimals)
    )

    return {
      serializedInstruction: serializeInstructionToBase64(createIx),
      isValid: true,
      governance: governanceAccount?.governance,
    }
  }

  useEffect(() => {
    handleSetInstructions(
      { governedAccount: governanceAccount?.governance, getInstruction },
      index
    )
  }, [form])

  return (
    <>
      <Select
        label="Raydium Liquidity Pool"
        value={form.liquidityPool}
        placeholder="Please select..."
        onChange={(value) =>
          handleSetForm({ value, propertyName: 'liquidityPool' })
        }
        error={formErrors['liquidityPool']}
      >
        <SelectOptionList list={Object.keys(liquidityPoolKeysList)} />
      </Select>

      <Input
        label={`LP Token Amount to withdraw - max: ${
          lpMintInfo ? lpMintInfo.balance : '-'
        }`}
        value={form.amountIn}
        type="number"
        min={0}
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'amountIn',
          })
        }
        error={formErrors['amountIn']}
      />
    </>
  )
}

export default RemoveLiquidityFromPool
