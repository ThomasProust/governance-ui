import * as yup from 'yup'

const governedAccountSchema = yup
  .object()
  .nullable()
  .required('Program governed account is required')

export const addRaydiumLiquidityPoolSchema = yup.object().shape({
  governedAccount: governedAccountSchema,
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
})

export const removeRaydiumLiquidityPoolSchema = yup.object().shape({
  governedAccount: governedAccountSchema,
  liquidityPool: yup.string().required('Liquidity Pool is required'),
  amountIn: yup
    .number()
    .moreThan(0, 'Amount for LP token should be more than 0')
    .required('Amount for LP token is required'),
})

export const createAssociatedTokenAccountSchema = yup.object().shape({
  governedAccount: yup
    .object()
    .nullable()
    .required('Governed account is required'),
  splTokenMintUIName: yup.string().required('SPL Token Mint is required'),
})

export const depositReserveLiquidityAndObligationCollateralSchema = yup
  .object()
  .shape({
    governedAccount: yup
      .object()
      .nullable()
      .required('Governed account is required'),
    mintName: yup.string().required('Token Name is required'),
    uiAmount: yup
      .number()
      .moreThan(0, 'Amount should be more than 0')
      .required('Amount is required'),
  })

export const refreshReserveSchema = yup.object().shape({
  governedAccount: yup
    .object()
    .nullable()
    .required('Governed account is required'),
  mintName: yup.string().required('Token Name is required'),
})
