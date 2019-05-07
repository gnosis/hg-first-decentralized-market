import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Web3 from "web3";
import Decimal from "decimal.js-light";
import PositionGroupDetails from "./position-group-details";
import Spinner from "./spinner";
import { formatCollateral } from "./utils/formatting";
import { calcPositionGroups } from "./utils/position-groups";

import cn from "classnames";

const { toBN } = Web3.utils;

const maxUint256 = toBN(`0x${"ff".repeat(32)}`);

function calcOutcomeTokenCounts(
  markets,
  positions,
  { funding, positionBalances },
  amount,
  marketSelections
) {
  if (
    marketSelections.every(
      ({ isAssumed, selectedOutcomeIndex }) =>
        isAssumed || selectedOutcomeIndex == null
    )
  )
    throw new Error("At least one outcome selection must be made");

  const invB = new Decimal(positions.length).ln().dividedBy(funding.toString());

  const positionTypes = new Array(positions.length).fill(null);

  const zero = new Decimal(0);
  let refundedTerm = zero;
  let takenTerm = zero;
  let refusedTerm = zero;
  positions.forEach(position => {
    const balance = positionBalances[position.positionIndex].toString();
    if (
      position.outcomes.some(
        ({ marketIndex, outcomeIndex }) =>
          marketSelections[marketIndex].isAssumed &&
          outcomeIndex !== marketSelections[marketIndex].selectedOutcomeIndex
      )
    ) {
      refundedTerm = refundedTerm.add(
        amount
          .sub(balance)
          .mul(invB)
          .exp()
      );
      positionTypes[position.positionIndex] = "refunded";
    } else if (
      position.outcomes.every(
        ({ marketIndex, outcomeIndex }) =>
          marketSelections[marketIndex].selectedOutcomeIndex == null ||
          outcomeIndex === marketSelections[marketIndex].selectedOutcomeIndex
      )
    ) {
      takenTerm = takenTerm.add(
        invB
          .mul(balance)
          .neg()
          .exp()
      );
      positionTypes[position.positionIndex] = "taken";
    } else {
      refusedTerm = refusedTerm.add(
        invB
          .mul(balance)
          .neg()
          .exp()
      );
      positionTypes[position.positionIndex] = "refused";
    }
  });

  const takenPositionsAmountEach = amount
    .mul(invB)
    .exp()
    .sub(refundedTerm)
    .sub(refusedTerm)
    .div(takenTerm)
    .ln()
    .div(invB)
    .toInteger();

  return positionTypes.map(type => {
    if (type === "taken") return takenPositionsAmountEach;
    if (type === "refunded") return amount;
    if (type === "refused") return zero;
    throw new Error(`Position types [${positionTypes.join(", ")}] invalid`);
  });
}

const BuySection = ({
  account,
  markets,
  positions,
  collateral,
  collateralBalance,
  lmsrMarketMaker,
  lmsrState,
  lmsrAllowance,
  marketSelections,
  stagedTradeAmounts,
  setStagedTradeAmounts,
  stagedTransactionType,
  setStagedTransactionType,
  ongoingTransactionType,
  asWrappedTransaction
}) => {
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [error, setError] = useState(null);
  useEffect(() => {
    if (investmentAmount === "") {
      setStagedTradeAmounts(null);
      setStagedTransactionType("buy outcome tokens");
      setError(null);
      return;
    }
    try {
      const investmentAmountInUnits = new Decimal(10)
        .pow(collateral.decimals)
        .mul(investmentAmount);

      if (!investmentAmountInUnits.isInteger())
        throw new Error(
          `Got more than ${
            collateral.decimals
          } decimals in value ${investmentAmount}`
        );

      if (investmentAmountInUnits.gt(collateralBalance.totalAmount.toString()))
        throw new Error(
          `Not enough collateral: missing ${formatCollateral(
            investmentAmountInUnits.sub(
              collateralBalance.totalAmount.toString()
            ),
            collateral
          )}`
        );

      setStagedTradeAmounts(
        calcOutcomeTokenCounts(
          markets,
          positions,
          lmsrState,
          investmentAmountInUnits,
          marketSelections
        )
      );
      setError(null);
    } catch (e) {
      setStagedTradeAmounts(null);
      setError(e);
    } finally {
      setStagedTransactionType("buy outcome tokens");
    }
  }, [
    markets,
    positions,
    collateral,
    collateralBalance,
    lmsrState,
    investmentAmount,
    marketSelections
  ]);

  let hasAnyAllowance = false;
  let hasEnoughAllowance = false;
  let hasInfiniteAllowance = false;
  if (lmsrAllowance != null)
    try {
      hasAnyAllowance = lmsrAllowance.gtn(0);
      hasEnoughAllowance = new Decimal(10)
        .pow(collateral.decimals)
        .mul(investmentAmount || "0")
        .lte(lmsrAllowance.toString());

      hasInfiniteAllowance = lmsrAllowance.eq(maxUint256);
    } catch (e) {
      // empty
    }

  async function buyOutcomeTokens() {
    if (stagedTradeAmounts == null) throw new Error(`No buy set yet`);

    if (stagedTransactionType !== "buy outcome tokens")
      throw new Error(
        `Can't buy outcome tokens while staged transaction is to ${stagedTransactionType}`
      );

    const tradeAmounts = stagedTradeAmounts.map(amount => amount.toString());
    const collateralLimit = await lmsrMarketMaker.calcNetCost(tradeAmounts);

    if (collateral.isWETH && collateralLimit.gt(collateralBalance.amount)) {
      await collateral.contract.deposit({
        value: collateralLimit.sub(collateralBalance.amount),
        from: account
      });
    }

    await lmsrMarketMaker.trade(tradeAmounts, collateralLimit, {
      from: account
    });
  }

  async function setAllowance() {
    await collateral.contract.approve(lmsrMarketMaker.address, maxUint256, {
      from: account
    });
  }

  const [stagedTradePositionGroups, setStagedTradePositionGroups] = useState(
    []
  );
  useEffect(() => {
    setStagedTradePositionGroups(
      stagedTradeAmounts &&
        calcPositionGroups(markets, positions, stagedTradeAmounts)
    );
  }, [markets, positions, stagedTradeAmounts]);

  return (
    <div className={cn("positions")}>
      {collateralBalance != null && (
        <p>{`Your balance: ${formatCollateral(
          collateralBalance.amount,
          collateral
        )}`}</p>
      )}
      {collateralBalance != null && collateral.isWETH && (
        <p>{`Your unwrapped balance: ${formatCollateral(
          collateralBalance.unwrappedAmount,
          collateral
        )}`}</p>
      )}
      {lmsrAllowance != null && (
        <p>{`Market maker allowance: ${
          hasInfiniteAllowance
            ? `∞ ${collateral.symbol}`
            : formatCollateral(lmsrAllowance, collateral)
        }`}</p>
      )}
      <input
        type="text"
        placeholder={`Investment amount in ${collateral.name}`}
        value={investmentAmount}
        onChange={e => {
          setInvestmentAmount(e.target.value);
        }}
      />
      <button
        type="button"
        disabled={
          !hasEnoughAllowance ||
          stagedTransactionType !== "buy outcome tokens" ||
          stagedTradeAmounts == null ||
          ongoingTransactionType != null ||
          error != null
        }
        onClick={asWrappedTransaction(
          "buy outcome tokens",
          buyOutcomeTokens,
          setError
        )}
      >
        {ongoingTransactionType === "buy outcome tokens" ? (
          <Spinner centered inverted width={25} height={25} />
        ) : (
          <>Buy</>
        )}
      </button>
      {((!hasAnyAllowance && stagedTradeAmounts == null) ||
        !hasEnoughAllowance) && (
        <button
          type="button"
          onClick={asWrappedTransaction(
            "set allowance",
            setAllowance,
            setError
          )}
        >
          {ongoingTransactionType === "set allowance" ? (
            <Spinner centered inverted width={25} height={25} />
          ) : (
            "Approve Market Maker for Trades"
          )}
        </button>
      )}
      {error && (
        <span className={cn("error")}>
          {error === true ? "An error has occured" : error.message}
        </span>
      )}

      {stagedTradePositionGroups != null && (
        <div>
          <div>You will receive:</div>
          {stagedTradePositionGroups.map(positionGroup => (
            <div key={positionGroup.collectionId} className={cn("position")}>
              <div className={cn("row", "details")}>
                <PositionGroupDetails
                  {...{
                    positionGroup,
                    collateral
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

BuySection.propTypes = {
  collateral: PropTypes.shape({
    name: PropTypes.string.isRequired,
    symbol: PropTypes.string.isRequired
  }).isRequired,
  collateralBalance: PropTypes.shape({
    amount: PropTypes.instanceOf(Decimal).isRequired,
    isWETH: PropTypes.bool,
    unwrappedAmount: PropTypes.string
  }).isRequired,

  stagedPositions: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      outcomeIds: PropTypes.string.isRequired,
      markets: PropTypes.arrayOf(
        PropTypes.shape({
          selectedOutcome: PropTypes.number.isRequired,
          when: PropTypes.string.isRequired,
          whenNot: PropTypes.string.isRequired
        }).isRequired
      ).isRequired
    }).isRequired
  ).isRequired,

  hasEnoughAllowance: PropTypes.bool.isRequired,

  handleBuyOutcomes: PropTypes.func.isRequired,
  handleSelectInvest: PropTypes.func.isRequired,
  handleSetAllowance: PropTypes.func.isRequired
};

export default BuySection;