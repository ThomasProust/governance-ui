import BigNumber from 'bignumber.js'
import { BN } from '@project-serum/anchor'
import {
  jsonInfo2PoolKeys,
  Liquidity,
  LiquidityPoolKeys,
  Percent,
  Token,
  TokenAmount,
} from '@raydium-io/raydium-sdk'
import { PublicKey } from '@solana/web3.js'
import { findATAAddrSync } from '@utils/ataTools'
import { ConnectionContext } from '@utils/connection'
import { liquidityPoolKeysList } from './poolKeys'

export const getAmountOut = async (
  liquidityPool: string,
  amountIn: number,
  connection: ConnectionContext,
  slippage: number //slippage in %
) => {
  const poolKeys = getLiquidityPoolKeysByLabel(liquidityPool)
  const [base, quote] = await Promise.all([
    connection.current.getTokenSupply(poolKeys.baseMint),
    connection.current.getTokenSupply(poolKeys.quoteMint),
  ])
  const amountInBN = new BN(
    new BigNumber(Number(amountIn).toFixed(base.value.decimals))
      .shiftedBy(base.value.decimals)
      .toString()
  )
  const { minAmountOut } = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo: await Liquidity.fetchInfo({
      connection: connection.current,
      poolKeys,
    }),
    amountIn: new TokenAmount(
      new Token(poolKeys.baseMint, base.value.decimals),
      amountInBN
    ),
    currencyOut: new Token(poolKeys.quoteMint, quote.value.decimals),
    slippage: new Percent(slippage, 10), // slippage in 1/1000
  })
  const currentPrice = minAmountOut.toFixed(quote.value.decimals)

  return Number(currentPrice) * amountIn
}

export const getLPMintInfo = async (
  connection: ConnectionContext,
  lpMint: PublicKey,
  user: PublicKey
) => {
  const [lpTokenAccount] = findATAAddrSync(user, lpMint)
  const [lpInfo, lpUserBalance] = await Promise.all([
    connection.current.getTokenSupply(lpMint),
    connection.current.getTokenAccountBalance(lpTokenAccount),
  ])
  return {
    lpTokenAccount,
    maxBalance: lpUserBalance.value.uiAmount ?? 0,
    decimals: lpInfo.value.decimals,
  }
}

export const getLiquidityPoolKeysByLabel = (
  label: string
): LiquidityPoolKeys => {
  const lp = Object.keys(liquidityPoolKeysList).find((lp) => lp === label)
  if (!lp) throw new Error(`pool not found for label ${label}`)

  return jsonInfo2PoolKeys(liquidityPoolKeysList[lp])
}
