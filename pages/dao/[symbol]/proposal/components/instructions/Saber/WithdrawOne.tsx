import * as yup from 'yup'
import useGovernanceAssets from '@hooks/useGovernanceAssets'
import {
  Governance,
  ProgramAccount,
  serializeInstructionToBase64,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-governance'
import saberPoolsConfiguration, { Pool } from '@tools/sdk/saber/pools'
import { withdrawOneInstruction } from '@saberhq/stableswap-sdk'
import { isFormValid } from '@utils/formValidation'
import {
  SaberPoolsWithdrawOneForm,
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

async function withdrawOne({
  authority,
  pool,
  destinationAccount,
  baseTokenName,
  poolTokenAmount,
  minimumTokenAmount,
}: {
  authority: PublicKey
  pool: Pool
  destinationAccount: PublicKey
  baseTokenName: string
  poolTokenAmount: BN
  minimumTokenAmount: BN
}): Promise<TransactionInstruction> {
  const poolTokenMintATA = await findAssociatedTokenAddress(
    authority,
    pool.poolToken.mint
  )

  // TRICKS
  // Have to add manually the toBuffer method as it's required by the @saberhq/stableswap-sdk package
  // le = little endian
  // 8 = 8 bytes = 64 bits
  poolTokenAmount.toBuffer = () => poolTokenAmount.toArrayLike(Buffer, 'le', 8)
  minimumTokenAmount.toBuffer = () =>
    minimumTokenAmount.toArrayLike(Buffer, 'le', 8)

  // Depending on the token we withdraw (tokenA or tokenB) then it changes the base/quote/admin mints
  let baseTokenAccount = pool.tokenAccountA.mint
  let quoteTokenAccount = pool.tokenAccountB.mint
  let adminDestinationAccount = pool.tokenAccountA.adminDestinationAccount

  if (baseTokenName === pool.tokenAccountB.name) {
    baseTokenAccount = pool.tokenAccountB.mint
    quoteTokenAccount = pool.tokenAccountA.mint
    adminDestinationAccount = pool.tokenAccountB.adminDestinationAccount
  }

  return withdrawOneInstruction({
    config: {
      authority: pool.swapAccountAuthority,
      swapAccount: pool.swapAccount,
      swapProgramID: saberPoolsConfiguration.saberStableSwapProgramId,
      tokenProgramID: TOKEN_PROGRAM_ID,
    },
    userAuthority: authority,
    poolMint: pool.poolToken.mint,
    sourceAccount: poolTokenMintATA,
    baseTokenAccount,
    quoteTokenAccount,
    destinationAccount,
    adminDestinationAccount,
    poolTokenAmount,
    minimumTokenAmount,
  })
}

const schema = yup.object().shape({
  assetAccount: yup
    .object()
    .nullable()
    .required('Governed account is required'),
  destinationAccount: yup.string().required('Destination Account is required'),
  baseTokenName: yup.string().required('Base Token Name is required'),
  uiPoolTokenAmount: yup
    .number()
    .moreThan(0, 'Pool Token Amount needs to be more than 0')
    .required('Pool Token Amount is required'),
  uiMinimumTokenAmount: yup
    .number()
    .moreThan(0, 'Minimum Token Amount needs to be more than 0')
    .required('Minimum Token Amount is required'),
})

const WithdrawOne = ({
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

  const [form, setForm] = useState<SaberPoolsWithdrawOneForm>({
    baseTokenName: '',
    destinationAccount: '',
    uiPoolTokenAmount: 0,
    uiMinimumTokenAmount: 0,
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

    const ix = await withdrawOne({
      authority: sourceAccount,
      pool,
      destinationAccount: new PublicKey(form.destinationAccount!),
      baseTokenName: form.baseTokenName!,
      poolTokenAmount: getMintNaturalAmountFromDecimalAsBN(
        form.uiPoolTokenAmount,
        pool.poolToken.decimals
      ),
      minimumTokenAmount: getMintNaturalAmountFromDecimalAsBN(
        form.uiMinimumTokenAmount,
        form.baseTokenName === pool.tokenAccountA.name
          ? pool.tokenAccountA.decimals
          : pool.tokenAccountB.decimals
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
          <Select
            label="Token to Withdraw"
            value={form.baseTokenName}
            placeholder="Please Select..."
            onChange={(value) => {
              handleSetForm({
                value,
                propertyName: 'baseTokenName',
              })
            }}
            error={formErrors['baseTokenName']}
          >
            <Select.Option value={pool.tokenAccountA.name}>
              {pool.tokenAccountA.name}
            </Select.Option>

            <Select.Option value={pool.tokenAccountB.name}>
              {pool.tokenAccountB.name}
            </Select.Option>
          </Select>
          <Input
            label={`${
              form.baseTokenName ? `${form.baseTokenName} ` : ''
            }Destination Account`}
            value={form.destinationAccount}
            type="string"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'destinationAccount',
              })
            }
            error={formErrors['destinationAccount']}
          />

          <Input
            label={`${pool.poolToken.name} Amount To Withdraw`}
            value={form.uiPoolTokenAmount}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'uiPoolTokenAmount',
              })
            }
            error={formErrors['uiPoolTokenAmount']}
          />

          <Input
            label={`Minimum ${
              form.baseTokenName ? `${form.baseTokenName} ` : ''
            }Amount To Withdraw`}
            value={form.uiMinimumTokenAmount}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'uiMinimumTokenAmount',
              })
            }
            error={formErrors['uiMinimumTokenAmount']}
          />
        </>
      )}
    </>
  )
}

export default WithdrawOne
