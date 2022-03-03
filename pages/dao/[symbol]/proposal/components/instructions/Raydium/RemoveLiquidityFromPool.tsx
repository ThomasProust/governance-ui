/* eslint-disable @typescript-eslint/no-non-null-assertion */
import BigNumber from 'bignumber.js'
import React, { useContext, useEffect, useState } from 'react'
import { jsonInfo2PoolKeys } from '@raydium-io/raydium-sdk'
import {
  Governance,
  ProgramAccount,
  serializeInstructionToBase64,
} from '@solana/spl-governance'
import { PublicKey } from '@solana/web3.js'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import useGovernedMultiTypeAccounts from '@hooks/useGovernedMultiTypeAccounts'
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
import GovernedAccountSelect from '../../GovernedAccountSelect'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import { removeRaydiumLiquidityPoolSchema } from '../../instructionForm/validationSchemas'
import SelectOptionList from '../../SelectOptionList'

const RemoveLiquidityFromPool = ({
  index,
  governance,
}: {
  index: number
  governance: ProgramAccount<Governance> | null
}) => {
  const { governedMultiTypeAccounts } = useGovernedMultiTypeAccounts()

  const shouldBeGoverned = index !== 0 && governance
  const [form, setForm] = useState<RemoveLiquidityRaydiumForm>({
    governedAccount: undefined,
    liquidityPool: '',
    amountIn: 0,
  })
  const handleFormChange = ({ propertyName, value }) => {
    setForm({ ...form, [propertyName]: value })
  }
  const {
    connection,
    formErrors,
    validateForm,
    canSerializeInstruction,
    handleSetForm,
  } = useInstructionFormBuilder(form, handleFormChange)

  const { handleSetInstructions } = useContext(NewProposalContext)

  const [lpMintInfo, setLpMintInfo] = useState<{
    balance: number
    decimals: number
  } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { maxBalance, decimals } = await fetchLiquidityPoolData({
          governanceKey: form.governedAccount?.governance.pubkey,
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
    })()
  }, [form.governedAccount?.governance.pubkey, form.liquidityPool])

  async function getInstruction(): Promise<UiInstruction> {
    const isSerializable = await canSerializeInstruction({
      form,
      schema: removeRaydiumLiquidityPoolSchema,
    })
    if (!isSerializable || !form.liquidityPool || !lpMintInfo) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: form.governedAccount?.governance,
      }
    }
    const createIx = createRemoveLiquidityInstruction(
      new PublicKey(form.governedAccount!.governance.pubkey),
      jsonInfo2PoolKeys(liquidityPoolKeysList[form.liquidityPool]),
      new BigNumber(form.amountIn).shiftedBy(lpMintInfo.decimals).toString()
    )

    return {
      serializedInstruction: serializeInstructionToBase64(createIx),
      isValid: true,
      governance: form.governedAccount?.governance,
    }
  }

  useEffect(() => {
    if (form.liquidityPool) {
      debounce.debounceFcn(async () => {
        await validateForm(removeRaydiumLiquidityPoolSchema, form)
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
        await validateForm(removeRaydiumLiquidityPoolSchema, form)
      })
    }
  }, [form.amountIn])

  useEffect(() => {
    handleSetInstructions(
      { governedAccount: form.governedAccount?.governance, getInstruction },
      index
    )
  }, [form])

  return (
    <>
      <GovernedAccountSelect
        label="Governance"
        governedAccounts={governedMultiTypeAccounts}
        onChange={(value) => {
          handleSetForm({ value, propertyName: 'governedAccount' })
        }}
        value={form.governedAccount}
        error={formErrors['governedAccount']}
        shouldBeGoverned={shouldBeGoverned}
        governance={governance}
      />
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
