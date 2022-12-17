import * as yup from 'yup'
import useGovernanceAssets from '@hooks/useGovernanceAssets'
import {
  Governance,
  ProgramAccount,
  serializeInstructionToBase64,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-governance'
import saberPoolsConfiguration, { Pool } from '@tools/sdk/saber/pools'
import { withdrawInstruction } from '@saberhq/stableswap-sdk'
import { isFormValid } from '@utils/formValidation'
import {
  SaberPoolsWithdrawForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { useState, useContext, useEffect } from 'react'
import useWalletStore from 'stores/useWalletStore'
import { NewProposalContext } from '../../../new'
import GovernedAccountSelect from '../../GovernedAccountSelect'
import Select from '@components/inputs/Select'
import Input from '@components/inputs/Input'
import { findAssociatedTokenAddress } from '@utils/associated'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { BN } from '@project-serum/anchor'
import { getMintNaturalAmountFromDecimalAsBN } from '@tools/sdk/units'
import { findATAAddrSync } from '@utils/ataTools'

async function withdraw({
  authority,
  pool,
  naturalPoolTokenAmount,
  naturalMinimumTokenAAmount,
  naturalMinimumTokenBAmount,
}: {
  authority: PublicKey
  pool: Pool
  naturalPoolTokenAmount: BN
  naturalMinimumTokenAAmount: BN
  naturalMinimumTokenBAmount: BN
}): Promise<TransactionInstruction> {
  const poolTokenMintATA = await findAssociatedTokenAddress(
    authority,
    pool.poolToken.mint
  )

  // TRICKS
  // Have to add manually the toBuffer method as it's required by the @saberhq/stableswap-sdk package
  // le = little endian
  // 8 = 8 bytes = 64 bits
  naturalPoolTokenAmount.toBuffer = () =>
    naturalPoolTokenAmount.toArrayLike(Buffer, 'le', 8)
  naturalMinimumTokenAAmount.toBuffer = () =>
    naturalMinimumTokenAAmount.toArrayLike(Buffer, 'le', 8)
  naturalMinimumTokenBAmount.toBuffer = () =>
    naturalMinimumTokenBAmount.toArrayLike(Buffer, 'le', 8)

  const [userAccountA] = findATAAddrSync(
    authority,
    pool.tokenAccountA.tokenMint
  )
  const [userAccountB] = findATAAddrSync(
    authority,
    pool.tokenAccountB.tokenMint
  )

  return withdrawInstruction({
    config: {
      authority: pool.swapAccountAuthority,
      swapAccount: pool.swapAccount,
      swapProgramID: saberPoolsConfiguration.saberStableSwapProgramId,
      tokenProgramID: TOKEN_PROGRAM_ID,
    },
    userAuthority: authority,
    poolMint: pool.poolToken.mint,
    tokenAccountA: pool.tokenAccountA.mint,
    tokenAccountB: pool.tokenAccountB.mint,
    sourceAccount: poolTokenMintATA,
    userAccountA,
    userAccountB,
    adminFeeAccountA: pool.tokenAccountA.adminDestinationAccount,
    adminFeeAccountB: pool.tokenAccountB.adminDestinationAccount,
    poolTokenAmount: naturalPoolTokenAmount,
    minimumTokenA: naturalMinimumTokenAAmount,
    minimumTokenB: naturalMinimumTokenBAmount,
  })
}

const schema = yup.object().shape({
  assetAccount: yup
    .object()
    .nullable()
    .required('Governed account is required'),
  poolTokenAmount: yup
    .number()
    .moreThan(0, 'Pool Token Amount needs to be more than 0')
    .required('Pool Token Amount is required'),
  minimumTokenAAmount: yup
    .number()
    .moreThan(0, 'Minimum Token A Amount needs to be more than 0')
    .required('Minimum Token Amount is required'),
  minimumTokenBAmount: yup
    .number()
    .moreThan(0, 'Minimum Token B Amount needs to be more than 0')
    .required('Minimum Token B Amount is required'),
})

const WithdrawFromSaber = ({
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
  const { governedTokenAccountsWithoutNfts } = useGovernanceAssets()
  const [pool, setPool] = useState<Pool | null>(null)

  const [form, setForm] = useState<SaberPoolsWithdrawForm>({
    poolTokenAmount: 0,
    minimumTokenAAmount: 0,
    minimumTokenBAmount: 0,
  })

  const handleSetForm = ({ propertyName, value }) => {
    setFormErrors({})
    setForm({ ...form, [propertyName]: value })
  }

  const validateInstruction = async (): Promise<boolean> => {
    const { isValid, validationErrors } = await isFormValid(schema, form)
    setFormErrors(validationErrors)
    return isValid
  }

  async function getInstruction(): Promise<UiInstruction> {
    const isValid = await validateInstruction()

    if (
      !connection ||
      !wallet?.publicKey ||
      !isValid ||
      !pool ||
      !form.assetAccount?.governance ||
      !form.assetAccount.extensions.token
    ) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: form.assetAccount?.governance,
      }
    }

    const sourceAccount = form.assetAccount.extensions.token.account.owner // this one is OK for both type of treasury governance (points to either wallet or governance pubkey)

    const ix = await withdraw({
      authority: sourceAccount,
      pool,
      naturalPoolTokenAmount: getMintNaturalAmountFromDecimalAsBN(
        form.poolTokenAmount,
        pool.poolToken.decimals
      ),
      naturalMinimumTokenAAmount: getMintNaturalAmountFromDecimalAsBN(
        form.minimumTokenAAmount,
        pool.tokenAccountA.decimals
      ),
      naturalMinimumTokenBAmount: getMintNaturalAmountFromDecimalAsBN(
        form.minimumTokenBAmount,
        pool.tokenAccountB.decimals
      ),
    })

    return {
      serializedInstruction: serializeInstructionToBase64(ix),
      isValid: true,
      governance: form.assetAccount.governance,
      shouldSplitIntoSeparateTxs: true,
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
        label="Source Account"
        governedAccounts={governedTokenAccountsWithoutNfts}
        onChange={(value) => {
          handleSetForm({ value, propertyName: 'assetAccount' })
        }}
        value={form.assetAccount}
        error={formErrors['assetAccount']}
        shouldBeGoverned={shouldBeGoverned}
        governance={governance}
        type="token"
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
            label={`${pool.poolToken.name} Amount To Withdraw`}
            value={form.poolTokenAmount}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'poolTokenAmount',
              })
            }
            error={formErrors['poolTokenAmount']}
          />

          <Input
            label={`Minimum ${pool.tokenAccountA.name}Amount To Withdraw`}
            value={form.minimumTokenAAmount}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'minimumTokenAAmount',
              })
            }
            error={formErrors['minimumTokenAAmount']}
          />
          <Input
            label={`Minimum ${pool.tokenAccountB.name}Amount To Withdraw`}
            value={form.minimumTokenBAmount}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'minimumTokenBAmount',
              })
            }
            error={formErrors['minimumTokenBAmount']}
          />
        </>
      )}
    </>
  )
}

export default WithdrawFromSaber
