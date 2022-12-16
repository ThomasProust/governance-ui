import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import Switch from '@components/Switch'
import useGovernanceAssets from '@hooks/useGovernanceAssets'
import { BN } from '@project-serum/anchor'
import { swapInstruction } from '@saberhq/stableswap-sdk'
import {
  Governance,
  ProgramAccount,
  serializeInstructionToBase64,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-governance'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import saberPoolsConfiguration, { Pool } from '@tools/sdk/saber/pools'
import { getMintNaturalAmountFromDecimalAsBN } from '@tools/sdk/units'
import { findATAAddrSync } from '@utils/ataTools'
import { isFormValid } from '@utils/formValidation'
import {
  SaberPoolsSwapForm,
  UiInstruction,
} from '@utils/uiTypes/proposalCreationTypes'
import { useState, useContext, useEffect } from 'react'
import useWalletStore from 'stores/useWalletStore'
import * as yup from 'yup'
import { NewProposalContext } from '../../../new'
import GovernedAccountSelect from '../../GovernedAccountSelect'

type SwapSide = 'swapAforB' | 'swapBforA'

async function swap({
  authority,
  pool,
  naturalAmountIn,
  naturalMinimumAmountOut,
  side,
}: {
  authority: PublicKey
  pool: Pool
  naturalAmountIn: BN
  naturalMinimumAmountOut: BN
  side: SwapSide
}): Promise<TransactionInstruction> {
  const sellToken =
    side === 'swapAforB' ? pool.tokenAccountA : pool.tokenAccountB
  const buyToken =
    side === 'swapAforB' ? pool.tokenAccountB : pool.tokenAccountA

  const [userSource] = findATAAddrSync(authority, sellToken.tokenMint)
  const [userDestination] = findATAAddrSync(authority, buyToken.tokenMint)

  // Counter intuitive but poolSource = sellToken and poolDestination = buyToken
  const poolSource = sellToken.mint
  const poolDestination = buyToken.mint
  const adminDestination = buyToken.adminDestinationAccount

  // TRICKS
  // Have to add manually the toBuffer method as it's required by the @saberhq/stableswap-sdk package
  // le = little endian
  // 8 = 8 bytes = 64 bits
  naturalAmountIn.toBuffer = () => naturalAmountIn.toArrayLike(Buffer, 'le', 8)
  naturalMinimumAmountOut.toBuffer = () =>
    naturalMinimumAmountOut.toArrayLike(Buffer, 'le', 8)

  return swapInstruction({
    config: {
      authority: pool.swapAccountAuthority,
      swapAccount: pool.swapAccount,
      swapProgramID: saberPoolsConfiguration.saberStableSwapProgramId,
      tokenProgramID: TOKEN_PROGRAM_ID,
    },
    userAuthority: authority,
    userSource,
    poolSource,
    poolDestination,
    userDestination,
    adminDestination,
    amountIn: naturalAmountIn,
    minimumAmountOut: naturalMinimumAmountOut,
  })
}

const schema = yup.object().shape({
  assetAccount: yup.object().nullable().required('Asset account is required'),
  amountIn: yup.number().required('Amount In is required'),
  minimumAmountOut: yup
    .number()
    .moreThan(0, 'Minimum Amount Out should be more than 0')
    .required('Minimum Amount Out is required'),
})

const Swap = ({
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
  const [swapSide, setSwapSide] = useState<SwapSide>('swapAforB')

  const [form, setForm] = useState<SaberPoolsSwapForm>({
    assetAccount: undefined,
    amountIn: 0,
    minimumAmountOut: 0,
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

    const authority = form.assetAccount.extensions.token.account.owner // this one is OK for both type of treasury governance (points to either wallet or governance pubkey)

    const ix = await swap({
      authority,
      pool,
      naturalAmountIn: getMintNaturalAmountFromDecimalAsBN(
        form.amountIn,
        pool.tokenAccountA.decimals
      ),
      naturalMinimumAmountOut: getMintNaturalAmountFromDecimalAsBN(
        form.minimumAmountOut,
        pool.poolToken.decimals
      ),
      side: swapSide,
    })
    return {
      serializedInstruction: serializeInstructionToBase64(ix),
      isValid: true,
      governance: form.assetAccount?.governance,
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

      {pool ? (
        <>
          <div className="flex mb-2">
            <span className="text-sm">
              Swap {pool.tokenAccountA.name} for {pool.tokenAccountB.name}
            </span>

            <Switch
              className="ml-2"
              checked={swapSide === 'swapBforA'}
              onChange={(b) => {
                setSwapSide(b ? 'swapBforA' : 'swapAforB')
              }}
            />

            <span className="text-sm ml-2">
              Swap {pool.tokenAccountB.name} for {pool.tokenAccountA.name}
            </span>
          </div>

          <Input
            label={`${
              swapSide === 'swapAforB'
                ? pool.tokenAccountA.name
                : pool.tokenAccountB.name
            } Amount`}
            value={form.amountIn}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'amountIn',
              })
            }
            error={formErrors['amountIn']}
          />

          <Input
            label={`${
              swapSide === 'swapAforB'
                ? pool.tokenAccountB.name
                : pool.tokenAccountA.name
            } Minimum Amount`}
            value={form.minimumAmountOut}
            type="number"
            min="0"
            onChange={(evt) =>
              handleSetForm({
                value: evt.target.value,
                propertyName: 'minimumAmountOut',
              })
            }
            error={formErrors['minimumAmountOut']}
          />
        </>
      ) : null}
    </>
  )
}

export default Swap
