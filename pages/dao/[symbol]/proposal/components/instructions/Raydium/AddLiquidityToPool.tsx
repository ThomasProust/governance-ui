/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect, useState } from 'react'
import BigNumber from 'bignumber.js'
import { BN } from '@project-serum/anchor'
import {
  Governance,
  ProgramAccount,
  serializeInstructionToBase64,
} from '@solana/spl-governance'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import useGovernedMultiTypeAccounts from '@hooks/useGovernedMultiTypeAccounts'
import { createAddLiquidityInstruction } from '@tools/sdk/raydium/createAddLiquidityInstruction'
import {
  getAmountOut,
  getLiquidityPoolKeysByLabel,
} from '@tools/sdk/raydium/helpers'
import { liquidityPoolKeysList } from '@tools/sdk/raydium/poolKeys'
import { debounce } from '@utils/debounce'
import {
  AddLiquidityRaydiumForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'

import { NewProposalContext } from '../../../new'
import GovernedAccountSelect from '../../GovernedAccountSelect'
import { addRaydiumLiquidityPoolSchema } from '../../instructionForm/validationSchemas'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'

const AddLiquidityToPool = ({
  index,
  governance,
}: {
  index: number
  governance: ProgramAccount<Governance> | null
}) => {
  const { governedMultiTypeAccounts } = useGovernedMultiTypeAccounts()
  const shouldBeGoverned = index !== 0 && governance
  const [form, setForm] = useState<AddLiquidityRaydiumForm>({
    governedAccount: undefined,
    liquidityPool: '',
    baseAmountIn: 0,
    quoteAmountIn: 0,
    fixedSide: 'base',
    slippage: 0.5,
  })

  const handleFormChange = ({ propertyName, value }) => {
    setForm({ ...form, [propertyName]: value })
  }

  const {
    connection,
    validateForm,
    canSerializeInstruction,
    handleSetForm,
    formErrors,
  } = useInstructionFormBuilder(form, handleFormChange)

  const { handleSetInstructions } = useContext(NewProposalContext)

  async function getInstruction(): Promise<UiInstruction> {
    if (
      !(await canSerializeInstruction({
        form,
        schema: addRaydiumLiquidityPoolSchema,
      }))
    ) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: form.governedAccount?.governance,
      }
    }

    const poolKeys = getLiquidityPoolKeysByLabel(form.liquidityPool)
    const [base, quote] = await Promise.all([
      connection.current.getTokenSupply(poolKeys.baseMint),
      connection.current.getTokenSupply(poolKeys.quoteMint),
    ])

    const createIx = createAddLiquidityInstruction(
      poolKeys,
      new BN(
        new BigNumber(form.baseAmountIn.toString())
          .shiftedBy(base.value.decimals)
          .toString()
      ),
      new BN(
        new BigNumber(form.quoteAmountIn.toString())
          .shiftedBy(quote.value.decimals)
          .toString()
      ),
      form.fixedSide,
      form.governedAccount!.governance.pubkey
    )
    const obj: UiInstruction = {
      serializedInstruction: serializeInstructionToBase64(createIx),
      isValid: true,
      governance: form.governedAccount?.governance,
    }
    return obj
  }

  useEffect(() => {
    if (form.baseAmountIn) {
      debounce.debounceFcn(async () => {
        handleSetForm({
          value: await getAmountOut(
            form.liquidityPool,
            form.baseAmountIn,
            connection,
            form.slippage
          ),
          propertyName: 'quoteAmountIn',
        })
        await validateForm(addRaydiumLiquidityPoolSchema, form)
      })
    }
  }, [form.baseAmountIn, form.slippage])

  useEffect(() => {
    validateForm(addRaydiumLiquidityPoolSchema, form)
  }, [form.quoteAmountIn])

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
        {Object.keys(liquidityPoolKeysList).map((pool, i) => (
          <Select.Option key={pool + i} value={pool}>
            {pool}
          </Select.Option>
        ))}
      </Select>

      {form.liquidityPool && (
        <>
          <Input
            label="Base Token Amount to deposit"
            value={form.baseAmountIn}
            type="number"
            min={0}
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'baseAmountIn',
              })
            }
            error={formErrors['baseAmountIn']}
          />

          <Select
            label="Slippage (%)"
            value={form.slippage}
            onChange={(value) =>
              handleSetForm({ value, propertyName: 'slippage' })
            }
            error={formErrors['slippage']}
          >
            {[0.5, 1, 2].map((value) => (
              <Select.Option key={value.toString()} value={value}>
                {value}
              </Select.Option>
            ))}
          </Select>

          <Input
            label="Quote Token Amount to deposit"
            value={form.quoteAmountIn}
            type="number"
            min={0}
            onChange={(evt) =>
              handleSetForm({
                value: Number(evt.target.value),
                propertyName: 'quoteAmountIn',
              })
            }
            disabled={true}
            error={formErrors['quoteAmountIn']}
          />
          <Select
            label="Fixed Side"
            value={form.fixedSide}
            placeholder="Please select..."
            onChange={(value) =>
              handleSetForm({ value, propertyName: 'fixedSide' })
            }
            error={formErrors['fixedSide']}
          >
            {['base', 'quote'].map((value) => (
              <Select.Option key={value} value={value}>
                {value}
              </Select.Option>
            ))}
          </Select>
        </>
      )}
    </>
  )
}

export default AddLiquidityToPool
