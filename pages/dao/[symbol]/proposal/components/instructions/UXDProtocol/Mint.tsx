import { useContext, useEffect, useState } from 'react'
import * as yup from 'yup'
import {
  Governance,
  ProgramAccount,
  serializeInstructionToBase64,
} from '@solana/spl-governance'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { UXD } from '@uxd-protocol/uxd-client'
import Input from '@components/inputs/Input'
import Select from '@components/inputs/Select'
import useGovernanceAssets from '@hooks/useGovernanceAssets'
import {
  DEPOSITORY_TYPES,
  getDepositoryMintSymbols,
  getDepositoryTypes,
  mintUXDIx,
} from '@tools/sdk/uxdProtocol'
import { findATAAddrSync } from '@utils/ataTools'
import { isFormValid } from '@utils/formValidation'
import {
  UiInstruction,
  UXDMintForm,
} from '@utils/uiTypes/proposalCreationTypes'
import useWalletStore from 'stores/useWalletStore'
import { NewProposalContext } from '../../../new'
import GovernedAccountSelect from '../../GovernedAccountSelect'
import SelectOptionList from '../../SelectOptionList'

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
const schema = yup.object().shape({
  governedAccount: yup
    .object()
    .nullable()
    .required('Governance account is required'),
  depositoryType: yup.string().required('Valid Depository type is required'),
  uxdProgram: yup.string().required('UXD Program address is required'),
  collateralName: yup.string().required('Collateral Name address is required'),
  collateralAmount: yup
    .number()
    .moreThan(0, 'Collateral amount should be more than 0')
    .required('Collateral Amount is required'),
})

const MintWithCredixDepository = ({
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

  const [form, setForm] = useState<UXDMintForm>({
    governedAccount: undefined,
    depositoryType: 'Credix',
    collateralAmount: 0,
    uxdProgram: 'UXD8m9cvwk4RcSxnX2HZ9VudQCEeDH6fRnB4CAP57Dr',
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
      !isValid ||
      !form.governedAccount?.governance?.account.governedAccount ||
      !wallet?.publicKey ||
      !form.collateralName
    ) {
      return {
        serializedInstruction: '',
        isValid: false,
        governance: form.governedAccount?.governance,
      }
    }
    const uxdProgramId = new PublicKey(form.uxdProgram)
    const authority = form.governedAccount.governance.pubkey

    const ix = await mintUXDIx(
      connection,
      uxdProgramId,
      form.depositoryType as DEPOSITORY_TYPES,
      {
        authority,
        payer: wallet.publicKey,
        collateralName: form.collateralName,
        collateralAmount: form.collateralAmount,
      }
    )

    const prerequisiteInstructions: TransactionInstruction[] = []
    const [authorityUXDATA] = findATAAddrSync(authority, UXD)
    checkInitTokenAccount(
      authorityUXDATA,
      prerequisiteInstructions,
      connection,
      UXD,
      authority,
      wallet.publicKey
    )

    return {
      serializedInstruction: serializeInstructionToBase64(ix),
      isValid: true,
      governance: form.governedAccount.governance,
      shouldSplitIntoSeparateTxs: true,
      prerequisiteInstructions,
    }
  }

  useEffect(() => {
    handleSetInstructions(
      {
        governedAccount: form.governedAccount?.governance,
        getInstruction,
      },
      index
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO please fix, it can cause difficult bugs. You might wanna check out https://bobbyhadz.com/blog/react-hooks-exhaustive-deps for info. -@asktree
  }, [form])

  return (
    <>
      <GovernedAccountSelect
        label="Governed account"
        governedAccounts={assetAccounts}
        onChange={(value) => {
          handleSetForm({ value, propertyName: 'governedAccount' })
        }}
        value={form.governedAccount}
        error={formErrors['governedAccount']}
        shouldBeGoverned={shouldBeGoverned}
        governance={governance}
      />
      <Select
        label="Depository Type"
        value={form.depositoryType}
        placeholder="Please select..."
        onChange={(value) =>
          handleSetForm({ value, propertyName: 'depositoryType' })
        }
        error={formErrors['depositoryType']}
      >
        <SelectOptionList list={getDepositoryTypes(false)} />
      </Select>

      <Input
        label="UXD Program"
        value={form.uxdProgram}
        type="string"
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'uxdProgram',
          })
        }
        error={formErrors['uxdProgram']}
      />

      <Select
        label="Collateral Name"
        value={form.collateralName}
        placeholder="Please select..."
        onChange={(value) =>
          handleSetForm({ value, propertyName: 'collateralName' })
        }
        error={formErrors['collateralName']}
      >
        <SelectOptionList list={getDepositoryMintSymbols(connection.cluster)} />
      </Select>

      <Input
        type="number"
        label="Collateral Amount"
        value={form.collateralAmount}
        min={0}
        max={10 ** 12}
        onChange={(evt) =>
          handleSetForm({
            value: evt.target.value,
            propertyName: 'collateralAmount',
          })
        }
        error={formErrors['collateralAmount']}
      />
    </>
  )
}

export default MintWithCredixDepository
