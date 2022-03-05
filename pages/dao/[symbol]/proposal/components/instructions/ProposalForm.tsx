import useGovernedMultiTypeAccounts from '@hooks/useGovernedMultiTypeAccounts'
import { ProgramAccount, Governance } from '@solana/spl-governance'
import { GovernedMultiTypeAccount } from '@utils/tokens'
import { useState } from 'react'
import GovernedAccountSelect from '../GovernedAccountSelect'
import { Instructions } from '@utils/uiTypes/proposalCreationTypes'
import Clawback from 'VoteStakeRegistry/components/instructions/Clawback'
import Grant from 'VoteStakeRegistry/components/instructions/Grant'
import ProgramUpgrade from './bpfUpgradeableLoader/ProgramUpgrade'
import CreateAssociatedTokenAccount from './CreateAssociatedTokenAccount'
import CustomBase64 from './CustomBase64'
import Empty from './Empty'
import MakeChangeMaxAccounts from './Mango/MakeChangeMaxAccounts'
import MakeChangeReferralFeeParams from './Mango/MakeChangeReferralFeeParams'
import AddLiquidityToPoolRaydium from './Raydium/AddLiquidityToPool'
import RemoveLiquidityFromPoolRaydium from './Raydium/RemoveLiquidityFromPool'
import Mint from './Mint'
import CreateObligationAccount from './Solend/CreateObligationAccount'
import DepositReserveLiquidityAndObligationCollateral from './Solend/DepositReserveLiquidityAndObligationCollateral'
import InitObligationAccount from './Solend/InitObligationAccount'
import RefreshObligation from './Solend/RefreshObligation'
import RefreshReserve from './Solend/RefreshReserve'
import WithdrawObligationCollateralAndRedeemReserveLiquidity from './Solend/WithdrawObligationCollateralAndRedeemReserveLiquidity'
import SplTokenTransfer from './SplTokenTransfer'

const ProposalForm = ({
  index,
  governance,
  itxType,
}: {
  index: number
  governance: ProgramAccount<Governance> | null
  itxType: number
}) => {
  const { governedMultiTypeAccounts } = useGovernedMultiTypeAccounts()

  const shouldBeGoverned = index !== 0 && governance

  const [governanceAccount, setGovernanceAccount] = useState<
    GovernedMultiTypeAccount | undefined
  >()

  const getCurrentInstruction = () => {
    switch (itxType) {
      case Instructions.Transfer:
        return (
          <SplTokenTransfer
            index={index}
            governance={governance}
          ></SplTokenTransfer>
        )
      case Instructions.ProgramUpgrade:
        return (
          <ProgramUpgrade
            index={index}
            governance={governance}
          ></ProgramUpgrade>
        )
      case Instructions.CreateAssociatedTokenAccount:
        return (
          <CreateAssociatedTokenAccount index={index} governance={governance} />
        )
      case Instructions.CreateSolendObligationAccount:
        return <CreateObligationAccount index={index} governance={governance} />
      case Instructions.InitSolendObligationAccount:
        return <InitObligationAccount index={index} governance={governance} />
      case Instructions.DepositReserveLiquidityAndObligationCollateral:
        return (
          <DepositReserveLiquidityAndObligationCollateral
            index={index}
            governance={governance}
          />
        )
      case Instructions.RefreshSolendObligation:
        return <RefreshObligation index={index} governance={governance} />
      case Instructions.RefreshSolendReserve:
        return <RefreshReserve index={index} governance={governance} />
      case Instructions.WithdrawObligationCollateralAndRedeemReserveLiquidity:
        return (
          <WithdrawObligationCollateralAndRedeemReserveLiquidity
            index={index}
            governance={governance}
          />
        )
      case Instructions.AddLiquidityRaydium:
        return (
          <AddLiquidityToPoolRaydium
            index={index}
            governanceAccount={governanceAccount}
          />
        )
      case Instructions.RemoveLiquidityRaydium:
        return (
          <RemoveLiquidityFromPoolRaydium
            index={index}
            governanceAccount={governanceAccount}
          />
        )
      case Instructions.Mint:
        return <Mint index={index} governance={governance}></Mint>
      case Instructions.Base64:
        return (
          <CustomBase64 index={index} governance={governance}></CustomBase64>
        )
      case Instructions.None:
        return <Empty index={index} governance={governance}></Empty>
      case Instructions.MangoMakeChangeMaxAccounts:
        return (
          <MakeChangeMaxAccounts
            index={index}
            governance={governance}
          ></MakeChangeMaxAccounts>
        )
      case Instructions.MangoChangeReferralFeeParams:
        return (
          <MakeChangeReferralFeeParams
            index={index}
            governance={governance}
          ></MakeChangeReferralFeeParams>
        )
      case Instructions.Grant:
        return <Grant index={index} governance={governance}></Grant>
      case Instructions.Clawback:
        return <Clawback index={index} governance={governance}></Clawback>
      default:
        null
    }
  }

  return (
    <>
      <GovernedAccountSelect
        label="Governance"
        governedAccounts={governedMultiTypeAccounts}
        onChange={(value) => {
          setGovernanceAccount(value)
        }}
        value={governanceAccount}
        shouldBeGoverned={shouldBeGoverned}
        governance={governance}
      />
      {getCurrentInstruction()}
    </>
  )
}

export default ProposalForm
