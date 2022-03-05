/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import BigNumber from 'bignumber.js'
import { BN } from '@project-serum/anchor'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
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
import { addRaydiumLiquidityPoolSchema } from '../../schemas/validationSchemas'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'
import SelectOptionList from '../../SelectOptionList'
import { GovernedMultiTypeAccount } from '@utils/tokens'

const AddLiquidityToPool = ({
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
    validateForm,
    canSerializeInstruction,
  } = useInstructionFormBuilder<AddLiquidityRaydiumForm>({
    initialFormValues: {
      governedAccount: undefined,
      liquidityPool: '',
      baseAmountIn: 0,
      quoteAmountIn: 0,
      fixedSide: 'base',
      slippage: 0.5,
    },
    schema: addRaydiumLiquidityPoolSchema,
  })

  const { handleSetInstructions } = useContext(NewProposalContext)

  async function getInstruction(): Promise<UiInstruction> {
    if (!(await canSerializeInstruction())) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: governanceAccount?.governance,
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
        await validateForm()
      })
    }
  }, [form.baseAmountIn, form.slippage])

  useEffect(() => {
    validateForm()
  }, [form.quoteAmountIn])

  useEffect(() => {
    handleSetInstructions(
      { governedAccount: form.governedAccount?.governance, getInstruction },
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
            <SelectOptionList list={[0.5, 1, 2]} />
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
            <SelectOptionList list={['base', 'quote']} />
          </Select>
        </>
      )}
    </>
  )
}

export default AddLiquidityToPool
