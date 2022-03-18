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
import MakeAddSpotMarket from './Mango/MakeAddSpotMarket'
import MakeChangePerpMarket from './Mango/MakeChangePerpMarket'
import MakeChangeSpotMarket from './Mango/MakeChangeSpotMarket'
import MakeCreatePerpMarket from './Mango/MakeCreatePerpMarket'
import MakeAddOracle from './Mango/MakeAddOracle'

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

  const [governedAccount, setGovernanceAccount] = useState<
    GovernedMultiTypeAccount | undefined
  >()

  const getCurrentInstruction = () => {
    switch (itxType) {
      case Instructions.Transfer:
        return <SplTokenTransfer index={index} governance={governance} />
      case Instructions.ProgramUpgrade:
        return <ProgramUpgrade index={index} governance={governance} />
      case Instructions.CreateAssociatedTokenAccount:
        return (
          <CreateAssociatedTokenAccount
            index={index}
            governedAccount={governedAccount}
          />
        )
      case Instructions.CreateSolendObligationAccount:
        return (
          <CreateObligationAccount
            index={index}
            governedAccount={governedAccount}
          />
        )
      case Instructions.InitSolendObligationAccount:
        return (
          <InitObligationAccount
            index={index}
            governedAccount={governedAccount}
          />
        )
      case Instructions.DepositReserveLiquidityAndObligationCollateral:
        return (
          <DepositReserveLiquidityAndObligationCollateral
            index={index}
            governedAccount={governedAccount}
          />
        )
      case Instructions.RefreshSolendObligation:
        return (
          <RefreshObligation index={index} governedAccount={governedAccount} />
        )
      case Instructions.RefreshSolendReserve:
        return (
          <RefreshReserve index={index} governedAccount={governedAccount} />
        )
      case Instructions.WithdrawObligationCollateralAndRedeemReserveLiquidity:
        return (
          <WithdrawObligationCollateralAndRedeemReserveLiquidity
            index={index}
            governedAccount={governedAccount}
          />
        )
      case Instructions.AddLiquidityRaydium:
        return (
          <AddLiquidityToPoolRaydium
            index={index}
            governedAccount={governedAccount}
          />
        )
      case Instructions.RemoveLiquidityRaydium:
        return (
          <RemoveLiquidityFromPoolRaydium
            index={index}
            governedAccount={governedAccount}
          />
        )
      case Instructions.Mint:
        return <Mint index={index} governance={governance} />
      case Instructions.Base64:
        return <CustomBase64 index={index} governance={governance} />
      case Instructions.None:
        return <Empty index={index} governance={governance} />
      case Instructions.MangoAddOracle:
        return <MakeAddOracle index={index} governance={governance} />
      case Instructions.MangoAddSpotMarket:
        return <MakeAddSpotMarket index={index} governance={governance} />
      case Instructions.MangoChangeMaxAccounts:
        return <MakeChangeMaxAccounts index={index} governance={governance} />
      case Instructions.MangoChangePerpMarket:
        return <MakeChangePerpMarket index={index} governance={governance} />
      case Instructions.MangoChangeReferralFeeParams:
        return (
          <MakeChangeReferralFeeParams index={index} governance={governance} />
        )
      case Instructions.MangoChangeSpotMarket:
        return <MakeChangeSpotMarket index={index} governance={governance} />
      case Instructions.MangoCreatePerpMarket:
        return <MakeCreatePerpMarket index={index} governance={governance} />

      case Instructions.Grant:
        return <Grant index={index} governance={governance} />
      case Instructions.Clawback:
        return <Clawback index={index} governance={governance} />
      default:
        null
    }
  }

  return (
    <>
      {![
        Instructions.Transfer,
        Instructions.Mint,
        Instructions.ProgramUpgrade,
        Instructions.Base64,
        Instructions.Clawback,
        Instructions.Grant,
        Instructions.MangoAddOracle,
        Instructions.MangoAddSpotMarket,
        Instructions.MangoChangePerpMarket,
        Instructions.MangoChangeSpotMarket,
        Instructions.MangoChangeReferralFeeParams,
        Instructions.MangoChangeMaxAccounts,
        Instructions.MangoCreatePerpMarket,
        Instructions.None,
        Instructions.DepositIntoVolt,
      ].includes(itxType) && (
        <GovernedAccountSelect
          label="Governance"
          governedAccounts={governedMultiTypeAccounts}
          onChange={(value) => {
            setGovernanceAccount(value)
          }}
          value={governedAccount}
          shouldBeGoverned={shouldBeGoverned}
          governance={governance}
        />
      )}
      {getCurrentInstruction()}
    </>
  )
}

export default ProposalForm
