/* eslint-disable @typescript-eslint/no-non-null-assertion */
import BigNumber from 'bignumber.js'
import React, { useContext, useEffect, useState } from 'react'
import { jsonInfo2PoolKeys } from '@raydium-io/raydium-sdk'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import { PublicKey } from '@solana/web3.js'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import { createRemoveLiquidityInstruction } from '@tools/sdk/raydium/createRemoveLiquidityInstruction'
import { fetchLiquidityPoolData } from '@tools/sdk/raydium/helpers'
import { liquidityPoolKeysList } from '@tools/sdk/raydium/poolKeys'
import { debounce } from '@utils/debounce'
import { notify } from '@utils/notifications'
import {
  RemoveLiquidityRaydiumForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'

import { NewProposalContext } from '../../../new'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import { removeRaydiumLiquidityPoolSchema } from '../../schemas/validationSchemas'
import SelectOptionList from '../../SelectOptionList'
import { GovernedMultiTypeAccount } from '@utils/tokens'

const RemoveLiquidityFromPool = ({
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
    validateForm,
    canSerializeInstruction,
    handleSetForm,
  } = useInstructionFormBuilder<RemoveLiquidityRaydiumForm>({
    initialFormValues: {
      governedAccount: governanceAccount,
      liquidityPool: '',
      amountIn: 0,
    },
    schema: removeRaydiumLiquidityPoolSchema,
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
    const isSerializable = await canSerializeInstruction()
    if (!isSerializable || !form.liquidityPool || !lpMintInfo) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: governanceAccount?.governance,
      }
    }
    const createIx = createRemoveLiquidityInstruction(
      new PublicKey(governanceAccount!.governance.pubkey),
      jsonInfo2PoolKeys(liquidityPoolKeysList[form.liquidityPool]),
      new BigNumber(form.amountIn).shiftedBy(lpMintInfo.decimals).toString()
    )

    return {
      serializedInstruction: serializeInstructionToBase64(createIx),
      isValid: true,
      governance: governanceAccount?.governance,
    }
  }

  useEffect(() => {
    if (form.liquidityPool) {
      debounce.debounceFcn(async () => {
        await validateForm()
      })
      handleSetForm({
        value: form.liquidityPool,
        propertyName: 'liquidityPool',
      })
    }
  }, [form.liquidityPool])

  useEffect(() => {
    if (form.amountIn) {
      debounce.debounceFcn(async () => {
        await validateForm()
      })
    }
  }, [form.amountIn])

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
