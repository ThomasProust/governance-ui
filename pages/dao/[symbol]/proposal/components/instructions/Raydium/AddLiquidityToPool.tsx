/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useEffect } from 'react'
import * as yup from 'yup'
import { serializeInstructionToBase64 } from '@solana/spl-governance'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import useInstructionFormBuilder from '@hooks/useInstructionFormBuilder'

import { createAddLiquidityInstruction } from '@tools/sdk/raydium/createAddLiquidityInstruction'
import {
  getAmountOut,
  getLiquidityPoolKeysByLabel,
} from '@tools/sdk/raydium/helpers'
import { liquidityPoolKeysList } from '@tools/sdk/raydium/poolKeys'
import { debounce } from '@utils/debounce'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import {
  AddLiquidityRaydiumForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { NewProposalContext } from '../../../new'
import SelectOptionList from '../../SelectOptionList'
import { uiAmountToNativeBN } from '@tools/sdk/units'

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
    canSerializeInstruction,
  } = useInstructionFormBuilder<AddLiquidityRaydiumForm>({
    initialFormValues: {
      governedAccount: governanceAccount,
      liquidityPool: '',
      baseAmountIn: 0,
      quoteAmountIn: 0,
      fixedSide: 'base',
      slippage: 0.5,
    },
    schema: yup.object().shape({
      governedAccount: yup
        .object()
        .nullable()
        .required('Program governed account is required'),
      liquidityPool: yup.string().required('Liquidity Pool is required'),
      baseAmountIn: yup
        .number()
        .moreThan(0, 'Amount for Base token should be more than 0')
        .required('Amount for Base token is required'),
      quoteAmountIn: yup
        .number()
        .moreThan(0, 'Amount for Quote token should be more than 0')
        .required('Amount for Quote token is required'),
      fixedSide: yup
        .string()
        .equals(['base', 'quote'])
        .required('Fixed Side is required'),
    }),
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
      uiAmountToNativeBN(form.baseAmountIn, base.value.decimals),
      uiAmountToNativeBN(form.quoteAmountIn, quote.value.decimals),
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
      })
    }
  }, [form.baseAmountIn, form.slippage])

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
