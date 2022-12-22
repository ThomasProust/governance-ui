import { nu64, struct, u8 } from 'buffer-layout'
import { AccountMetaData } from '@solana/spl-governance'
import { Connection } from '@solana/web3.js'
import saberPoolsConfiguration, { SwapSide } from '@tools/sdk/saber/pools'
import { tryGetTokenMint } from '@utils/tokens'
import { getDecimalAmountFromNaturalBN } from '@tools/sdk/units'
import {
  DataUIAddress,
  DataUIAmount,
  DataUILabel,
  DataUIRow,
  DataUIText,
  InstructionDataUI,
} from '@components/InstructionDataUI'

export const SABER_POOLS_PROGRAM_INSTRUCTIONS = {
  [saberPoolsConfiguration.saberStableSwapProgramId.toBase58()]: {
    [saberPoolsConfiguration.stableSwapInstructions.deposit]: {
      name: 'Saber Pools - Deposit',
      accounts: [
        'Swap Account',
        'Swap Account Authority',
        'Source A',
        'Source B',
        'Token Account A',
        'Token Account B',
        'Pool Token Mint',
        'Pool Token Amount',
        'Token Program Id',
      ],
      getDataUI: (
        _connection: Connection,
        data: Uint8Array,
        accounts: AccountMetaData[]
      ) => {
        const sourceA = accounts[3].pubkey
        const sourceB = accounts[4].pubkey
        const tokenAccountA = accounts[5].pubkey
        const tokenAccountB = accounts[6].pubkey

        const pool = saberPoolsConfiguration.getPoolByTokenAccounts(
          tokenAccountA,
          tokenAccountB
        )

        if (!pool) {
          return <div>Unknown Pool</div>
        }

        const dataLayout = struct([
          u8('instruction'),
          nu64('tokenAmountA'),
          nu64('tokenAmountB'),
          nu64('minimumPoolTokenAmount'),
        ])

        const { tokenAmountA, tokenAmountB } = dataLayout.decode(
          Buffer.from(data)
        ) as any

        const uiTokenAmountA = getDecimalAmountFromNaturalBN(
          tokenAmountA,
          pool.tokenAccountA.decimals
        )

        const uiTokenAmountB = getDecimalAmountFromNaturalBN(
          tokenAmountB,
          pool.tokenAccountB.decimals
        )

        return (
          <InstructionDataUI>
            <DataUIRow>
              <DataUILabel label={`From ${pool.tokenAccountA.name} Account`} />
              <DataUIAddress address={sourceA} />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={`From ${pool.tokenAccountB.name} Account`} />
              <DataUIAddress address={sourceB} />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={`${pool.tokenAccountA.name} Amount`} />
              <DataUIAmount
                amount={Number(uiTokenAmountA)}
                symbol={pool.tokenAccountA.name}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={`${pool.tokenAccountB.name} Amount`} />
              <DataUIAmount
                amount={Number(uiTokenAmountB)}
                symbol={pool.tokenAccountB.name}
              />
            </DataUIRow>
          </InstructionDataUI>
        )
      },
    },

    [saberPoolsConfiguration.stableSwapInstructions.withdrawOne]: {
      name: 'Saber Pools - Withdraw One',
      accounts: [
        'Swap Account',
        'Swap Account Authority',
        'User Authority',
        'Pool Mint',
        'Source Account',
        'Base Token Account',
        'Quote Token Account',
        'Destination Token Account',
        'Admin Destination Account',
        'Token Program Id',
      ],
      getDataUI: (
        _connection: Connection,
        data: Uint8Array,
        accounts: AccountMetaData[]
      ) => {
        const owner = accounts[2].pubkey

        const baseTokenAccount = accounts[5].pubkey
        const quoteTokenAccount = accounts[6].pubkey
        const destinationAccount = accounts[7].pubkey

        const pool = saberPoolsConfiguration.getPoolByTokenAccounts(
          baseTokenAccount,
          quoteTokenAccount
        )

        if (!pool) {
          return <div>Unknown Pool</div>
        }

        const baseTokenAccountInfo = baseTokenAccount.equals(
          pool.tokenAccountA.mint
        )
          ? pool.tokenAccountA
          : pool.tokenAccountB

        const dataLayout = struct([
          u8('instruction'),
          nu64('poolTokenAmount'),
          nu64('minimumTokenAmount'),
        ])

        const { poolTokenAmount, minimumTokenAmount } = dataLayout.decode(
          Buffer.from(data)
        ) as any

        const uiPoolTokenAmount = getDecimalAmountFromNaturalBN(
          poolTokenAmount,
          pool.poolToken.decimals
        )

        const uiMinimumTokenAmount = getDecimalAmountFromNaturalBN(
          minimumTokenAmount,
          baseTokenAccountInfo.decimals
        )

        return (
          <InstructionDataUI>
            <DataUIRow>
              <DataUILabel label="Owner" />
              <DataUIAddress address={owner} />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label="LP Token Withdraw Amount" />
              <DataUIAmount
                amount={Number(uiPoolTokenAmount)}
                symbol={pool.poolToken.name}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label="Minimum Token Received" />
              <DataUIAmount
                amount={Number(uiMinimumTokenAmount)}
                symbol={baseTokenAccountInfo.name}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label="Destination Account" />
              <DataUIAddress address={destinationAccount} />
            </DataUIRow>
          </InstructionDataUI>
        )
      },
    },

    [saberPoolsConfiguration.stableSwapInstructions.withdraw]: {
      name: 'Saber Pools - Withdraw',
      accounts: [
        'Swap Account',
        'Authority',
        'User Authority',
        'Pool Mint',
        'Source Account',
        'Token Account A',
        'Token Account B',
        'User Account A',
        'User Account B',
        'Admin Fee Account A',
        'Admin Fee Account B',
        'Token Program Id',
      ],
      getDataUI: async (
        connection: Connection,
        data: Uint8Array,
        accounts: AccountMetaData[]
      ) => {
        const tokenAccountA = accounts[5].pubkey
        const tokenAccountB = accounts[6].pubkey
        const destAccountA = accounts[7].pubkey
        const destAccountB = accounts[8].pubkey

        const pool = saberPoolsConfiguration.getPoolByTokenAccounts(
          tokenAccountA,
          tokenAccountB
        )

        if (!pool) {
          return <div>Unknown Pool</div>
        }

        const dataLayout = struct([
          u8('instruction'),
          nu64('poolTokenAmount'),
          nu64('minimumTokenA'),
          nu64('minimumTokenB'),
        ])

        const {
          poolTokenAmount,
          minimumTokenA,
          minimumTokenB,
        } = dataLayout.decode(Buffer.from(data)) as any

        const uiPoolTokenAmount = getDecimalAmountFromNaturalBN(
          poolTokenAmount,
          pool.poolToken.decimals
        )
        const uiMinimumTokenA = getDecimalAmountFromNaturalBN(
          minimumTokenA,
          pool.tokenAccountA.decimals
        )
        const uiMinimumTokenB = getDecimalAmountFromNaturalBN(
          minimumTokenB,
          pool.tokenAccountB.decimals
        )

        return (
          <InstructionDataUI>
            <DataUIRow>
              <DataUILabel label={'Pool'} />
              <DataUIText
                text={`${pool.tokenAccountA.name}x${pool.tokenAccountB.name}`}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={'LP Token Amount'} />
              <DataUIAmount
                amount={uiPoolTokenAmount}
                symbol={pool.poolToken.name}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={'Minimum Token A'} />
              <DataUIAmount
                amount={uiMinimumTokenA}
                symbol={pool.tokenAccountA.name}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={'Recipient Token A'} />
              <DataUIAddress address={destAccountA} />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={'Minimum Token B'} />
              <DataUIAmount
                amount={uiMinimumTokenB}
                symbol={pool.tokenAccountB.name}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label={'Recipient Token B'} />
              <DataUIAddress address={destAccountB} />
            </DataUIRow>
          </InstructionDataUI>
        )
      },
    },

    [saberPoolsConfiguration.stableSwapInstructions.swap]: {
      name: 'Saber Pools - Swap',
      accounts: [
        'Swap Account',
        'Authority',
        'User Authority',
        'User Source',
        'Pool Source',
        'Pool Destination',
        'User Destination',
        'Admin Destination',
        'Token Program Id',
      ],

      getDataUI: async (
        connection: Connection,
        data: Uint8Array,
        accounts: AccountMetaData[]
      ) => {
        const userSource = accounts[3].pubkey
        const poolDestination = accounts[5].pubkey

        const [mintSell, mintBuy] = await Promise.all([
          tryGetTokenMint(connection, userSource),
          tryGetTokenMint(connection, poolDestination),
        ])

        if (!mintSell || !mintBuy) {
          throw new Error('Cannot load info about mints')
        }

        const pool = saberPoolsConfiguration.getPoolByTokenMints(
          mintSell.publicKey,
          mintBuy.publicKey
        )

        if (!pool) {
          return <div>Unknown Pool</div>
        }

        const swapSide: SwapSide = pool.tokenAccountA.tokenMint.equals(
          mintSell.publicKey
        )
          ? 'swapAforB'
          : 'swapBforA'

        const sellToken =
          swapSide === 'swapAforB' ? pool.tokenAccountA : pool.tokenAccountB
        const buyToken =
          swapSide === 'swapAforB' ? pool.tokenAccountB : pool.tokenAccountA

        const dataLayout = struct([
          u8('instruction'),
          nu64('amountIn'),
          nu64('minimumAmountOut'),
        ])

        const { amountIn, minimumAmountOut } = dataLayout.decode(
          Buffer.from(data)
        ) as any

        const uiAmountIn = getDecimalAmountFromNaturalBN(
          amountIn,
          sellToken.decimals
        )

        const uiMinimumAmountOut = getDecimalAmountFromNaturalBN(
          minimumAmountOut,
          buyToken.decimals
        )

        return (
          <InstructionDataUI>
            <DataUIRow>
              <DataUILabel label="Swap Operation" />
              <DataUIText
                text={`Sell ${sellToken.name} for ${buyToken.name}`}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label="Amount In" />
              <DataUIAmount
                amount={Number(uiAmountIn)}
                symbol={sellToken.name}
              />
            </DataUIRow>
            <DataUIRow>
              <DataUILabel label="Minimum Amount Out" />
              <DataUIAmount
                amount={Number(uiMinimumAmountOut)}
                symbol={buyToken.name}
              />
            </DataUIRow>
          </InstructionDataUI>
        )
      },
    },
  },
}
