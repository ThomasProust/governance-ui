import { useContext, useEffect, useState } from 'react'
import * as yup from 'yup'
import { BN } from '@project-serum/anchor'
import { depositInstruction } from '@saberhq/stableswap-sdk'
import {
  Governance,
  ProgramAccount,
  serializeInstructionToBase64,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-governance'
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from '@solana/spl-token'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import useGovernanceAssets from '@hooks/useGovernanceAssets'
import saberPoolsConfiguration, { Pool } from '@tools/sdk/saber/pools'
import { getMintNaturalAmountFromDecimalAsBN } from '@tools/sdk/units'
import { findAssociatedTokenAddress } from '@utils/associated'
import { findATAAddrSync } from '@utils/ataTools'
import { isFormValid } from '@utils/formValidation'
import {
  SaberPoolsDepositForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'

import useWalletStore from 'stores/useWalletStore'

import { NewProposalContext } from '../../../new'
import GovernedAccountSelect from '../../GovernedAccountSelect'

async function deposit({
  authority,
  pool,
  tokenAmountA,
  tokenAmountB,
  minimumPoolTokenAmount,
}: {
  authority: PublicKey
  pool: Pool
  tokenAmountA: BN
  tokenAmountB: BN
  minimumPoolTokenAmount: BN
}): Promise<TransactionInstruction> {
  const poolTokenMintATA = await findAssociatedTokenAddress(
    authority,
    pool.poolToken.mint
  )

  const [sourceA] = findATAAddrSync(authority, pool.tokenAccountA.tokenMint)
  const [sourceB] = findATAAddrSync(authority, pool.tokenAccountB.tokenMint)

  // TRICKS
  // Have to add manually the toBuffer method as it's required by the @saberhq/stableswap-sdk package
  // le = little endian
  // 8 = 8 bytes = 64 bits
  tokenAmountA.toBuffer = () => tokenAmountA.toArrayLike(Buffer, 'le', 8)
  tokenAmountB.toBuffer = () => tokenAmountB.toArrayLike(Buffer, 'le', 8)
  minimumPoolTokenAmount.toBuffer = () =>
    minimumPoolTokenAmount.toArrayLike(Buffer, 'le', 8)

  return depositInstruction({
    config: {
      authority: pool.swapAccountAuthority,
      swapAccount: pool.swapAccount,
      swapProgramID: saberPoolsConfiguration.saberStableSwapProgramId,
      tokenProgramID: TOKEN_PROGRAM_ID,
    },
    userAuthority: authority,
    sourceA,
    sourceB,
    tokenAccountA: pool.tokenAccountA.mint,
    tokenAccountB: pool.tokenAccountB.mint,
    poolTokenMint: pool.poolToken.mint,
    poolTokenAccount: poolTokenMintATA,
    tokenAmountA,
    tokenAmountB,
    minimumPoolTokenAmount,
  })
}

const schema = yup.object().shape({
  assetAccount: yup
    .object()
    .nullable()
    .required('Governed account is required'),
  uiTokenAmountA: yup.number().required('Amount for Token A is required'),
  uiTokenAmountB: yup.number().required('Amount for Token B is required'),
  uiMinimumPoolTokenAmount: yup
    .number()
    .moreThan(0, 'Minimum Pool Token Amount should be more than 0')
    .required('Minimum Pool Token Amount is required'),
})

async function checkInitTokenAccount(
  account: PublicKey,
  instructions: TransactionInstruction[],
  connection: any,
  mint: PublicKey,
  owner: PublicKey,
  feePayer: PublicKey
) {
  const accountInfo = await connection.current.getAccountInfo(account)
  if (accountInfo && accountInfo.lamports > 0) {
    return
  }
  instructions.push(
    Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID, // always ASSOCIATED_TOKEN_PROGRAM_ID
      TOKEN_PROGRAM_ID, // always TOKEN_PROGRAM_ID
      mint, // mint
      account, // ata
      owner, // owner of token account
      feePayer
    )
  )
}

const Deposit = ({
  index,
  governance,
}: {
  index: number
  governance: ProgramAccount<Governance> | null
}) => {
  const connection = useWalletStore((s) => s.connection)
  const wallet = useWalletStore((s) => s.current)
  const shouldBeGoverned = !!(index !== 0 && governance)
  const [formErrors, setFormErrors] = useState({})
  const { handleSetInstructions } = useContext(NewProposalContext)
  const { assetAccounts } = useGovernanceAssets()

  const [pool, setPool] = useState<Pool | null>(null)

  const [
    associatedTokenAccounts,
    setAssociatedTokenAccounts,
  ] = useState<null | {
    A: {
      account: PublicKey
      uiBalance: string
    }
    B: {
      account: PublicKey
      uiBalance: string
    }
  }>(null)

  const [form, setForm] = useState<SaberPoolsDepositForm>({
    assetAccount: undefined,
    uiTokenAmountA: 0,
    uiTokenAmountB: 0,
    uiMinimumPoolTokenAmount: 0,
  })

  const handleSetForm = ({ propertyName, value }) => {
    setFormErrors({})
    setForm({ ...form, [propertyName]: value })
  }

  useEffect(() => {
    ;(async () => {
      if (!form.assetAccount?.pubkey || !form.assetAccount.extensions.token) {
        return
      }

      if (!pool) {
        setAssociatedTokenAccounts(null)
        return
      }

      const sourceAccount = form.assetAccount.extensions.token.account.owner
      const assetTokenMint = form.assetAccount.extensions.token?.account.mint

      // We check if the asset account selected has at least one token common to the selected pool
      if (
        !assetTokenMint.equals(pool.tokenAccountA.tokenMint) &&
        !assetTokenMint.equals(pool.tokenAccountB.tokenMint)
      ) {
        setAssociatedTokenAccounts(null)
        return
      }

      const [sourceA] = findATAAddrSync(
        sourceAccount,
        pool.tokenAccountA.tokenMint
      )

      const [sourceB] = findATAAddrSync(
        sourceAccount,
        pool.tokenAccountB.tokenMint
      )

      const [resA, resB] = await Promise.allSettled([
        connection.current.getTokenAccountBalance(sourceA),
        connection.current.getTokenAccountBalance(sourceB),
      ])
      let amountA = ''
      if (resA.status !== 'rejected') {
        amountA = resA.value.value.uiAmountString ?? ''
      }
      let amountB = ''
      if (resB.status !== 'rejected') {
        amountB = resB.value.value.uiAmountString ?? ''
      }

      setAssociatedTokenAccounts({
        A: {
          account: sourceA,
          uiBalance: amountA,
        },
        B: {
          account: sourceB,
          uiBalance: amountB,
        },
      })
    })()
  }, [
    pool,
    form.assetAccount?.pubkey,
    form.assetAccount?.extensions.token,
    connection,
  ])

  const validateInstruction = async (): Promise<boolean> => {
    const { isValid, validationErrors } = await isFormValid(schema, form)
    setFormErrors(validationErrors)
    return isValid
  }

  async function getInstruction(): Promise<UiInstruction> {
    const isValid = await validateInstruction()

    if (
      !connection ||
      !isValid ||
      !pool ||
      !form.assetAccount?.governance ||
      !form.assetAccount.extensions.token ||
      !wallet?.publicKey
    ) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: form.assetAccount?.governance,
      }
    }
    const sourceAccount = form.assetAccount.extensions.token.account.owner // this one is OK for both type of treasury governance (points to either wallet or governance pubkey)

    const prerequisiteInstructions: TransactionInstruction[] = []
    const [poolTokenAccount] = findATAAddrSync(
      sourceAccount,
      pool.poolToken.mint
    )
    checkInitTokenAccount(
      poolTokenAccount,
      prerequisiteInstructions,
      connection,
      pool.poolToken.mint,
      sourceAccount,
      wallet.publicKey
    )

    const ix = await deposit({
      authority: form.assetAccount.extensions.token.account.owner,
      pool,
      tokenAmountA: getMintNaturalAmountFromDecimalAsBN(
        form.uiTokenAmountA,
        pool.tokenAccountA.decimals
      ),
      tokenAmountB: getMintNaturalAmountFromDecimalAsBN(
        form.uiTokenAmountB,
        pool.tokenAccountB.decimals
      ),
      minimumPoolTokenAmount: getMintNaturalAmountFromDecimalAsBN(
        form.uiMinimumPoolTokenAmount,
        pool.poolToken.decimals
      ),
    })

    return {
      serializedInstruction: serializeInstructionToBase64(ix),
      isValid: true,
      governance: form.assetAccount.governance,
      shouldSplitIntoSeparateTxs: true,
      prerequisiteInstructions,
    }
  }

  useEffect(() => {
    handleSetInstructions(
      {
        governedAccount: form.assetAccount?.governance,
        getInstruction,
      },
      index
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO please fix, it can cause difficult bugs. You might wanna check out https://bobbyhadz.com/blog/react-hooks-exhaustive-deps for info. -@asktree
  }, [form])

  return (
    <>
      <GovernedAccountSelect
        label="Source account"
        governedAccounts={assetAccounts}
        onChange={(value) => {
          handleSetForm({ value, propertyName: 'assetAccount' })
        }}
        value={form.assetAccount}
        error={formErrors['assetAccount']}
        shouldBeGoverned={shouldBeGoverned}
        governance={governance}
      />
      <Select
        label="Pool"
        value={form.poolName}
        placeholder="Please select..."
        onChange={(value) => {
          handleSetForm({
            value,
            propertyName: 'poolName',
          })

          setPool(saberPoolsConfiguration.pools[value] ?? null)
        }}
        error={formErrors['poolName']}
      >
        {Object.keys(saberPoolsConfiguration.pools).map((name) => (
          <Select.Option key={name} value={name}>
            {name}
          </Select.Option>
        ))}
      </Select>

      {pool && (
        <>
          <Input
            label={`${pool.tokenAccountA.name} Amount`}
            value={form.uiTokenAmountA}
            type="number"
            disabled={associatedTokenAccounts?.A.uiBalance == ''}
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'uiTokenAmountA',
              })
            }
            error={formErrors['uiTokenAmountA']}
          />

          {associatedTokenAccounts ? (
            <div className="text-xs text-fgd-3 mt-0 flex flex-col">
              <span>
                {pool.tokenAccountA.name} ATA:
                {associatedTokenAccounts?.A.account.toBase58() ?? '-'}
              </span>

              <span>
                {associatedTokenAccounts?.A.uiBalance !== ''
                  ? `max: ${associatedTokenAccounts?.A.uiBalance}`
                  : 'ACCOUNT NOT AVAILABLE'}
              </span>
            </div>
          ) : null}

          <Input
            label={`${pool.tokenAccountB.name} Amount`}
            value={form.uiTokenAmountB}
            disabled={associatedTokenAccounts?.B.uiBalance == ''}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'uiTokenAmountB',
              })
            }
            error={formErrors['uiTokenAmountB']}
          />

          {associatedTokenAccounts ? (
            <div className="text-xs text-fgd-3 mt-0 flex flex-col">
              <span>
                {pool.tokenAccountB.name} ATA:{' '}
                {associatedTokenAccounts?.B.account.toBase58() ?? '-'}
              </span>

              <span>
                {' '}
                {associatedTokenAccounts?.B.uiBalance !== ''
                  ? `max: ${associatedTokenAccounts?.B.uiBalance}`
                  : 'ACCOUNT NOT AVAILABLE'}
              </span>
            </div>
          ) : null}

          <Input
            label={`${pool.poolToken.name} Minimum Amount`}
            value={form.uiMinimumPoolTokenAmount}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'uiMinimumPoolTokenAmount',
              })
            }
            error={formErrors['uiMinimumPoolTokenAmount']}
          />
        </>
      )}
    </>
  )
}

export default Deposit
