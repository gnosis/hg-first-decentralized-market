import React, { useState, useEffect, useCallback } from "react";
import cn from "classnames/bind";
import Spinner from "components/Spinner";

import { fromProbabilityToSlider } from "utils/scalar";
import { formatScalarValue } from "utils/formatting";

import style from "./buy.scss";
import Decimal from "decimal.js-light";
import { zeroDecimal, maxUint256BN } from "../../utils/constants";
import {
  calcOutcomeTokenCounts
} from "utils/position-groups";

const cx = cn.bind(style);

import getMarketMakersRepo from "../../repositories/MarketMakersRepo";
import getConditionalTokensService from "../../services/ConditionalTokensService";
let marketMakersRepo;
let conditionalTokensService;

const Buy = ({
  market,
  lmsrState,
  probabilities,
  marketSelection,
  setMarketSelections,
  stagedTradeAmounts,
  stagedTransactionType,
  collateral,
  collateralBalance,
  account,
  lmsrAllowance,
  positions,
  marketSelections,
  setStagedTradeAmounts,
  setStagedTransactionType,
  ongoingTransactionType,
  resetMarketSelections,
  asWrappedTransaction
}) => {
  // Memoize fetching data files
  const loadDataLayer = useCallback(() => {
    async function getRepo() {
      marketMakersRepo = await getMarketMakersRepo();
      conditionalTokensService = await getConditionalTokensService();
    }
    getRepo();
  }, []);

  // Load data layer just on page load
  useEffect(() => {
    loadDataLayer();
  }, []);

  const [profitSim, setProfitSim] = useState({
    value: 0,
    percent: "0"
  });

  const [investmentAmount, setInvestmentAmount] = useState("");
  const [sliderValue, setSliderValue] = useState(parseFloat(market.lowerBound));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (probabilities) {
      const value = fromProbabilityToSlider(market, probabilities[0]);
      setSliderValue(value);
    }
  }, []);

  const handleSliderChange = useCallback(e => {
    setSliderValue(parseFloat(e.target.value));
  }, []);

  useEffect(() => {
    if (lmsrState != null) {
      const { funding, positionBalances } = lmsrState;

      const decimalUpper = new Decimal(market.upperBound);
      const decimalLower = new Decimal(market.lowerBound);

      const maxPayout = new Decimal(1337);
      //const minPayout = zeroDecimal;

      const normalizedSlider = new Decimal(sliderValue)
        .sub(decimalLower)
        .div(decimalUpper.sub(decimalLower));

      const profitAmount = maxPayout.mul(normalizedSlider);
      setProfitSim({
        value: profitAmount.toNumber(),
        percent: 0 // diff to cur position
      });
    }
  }, [lmsrState, sliderValue]);

  useEffect(() => {
    //if (stagedTransactionType !== "buy outcome tokens") return;

    let hasEnteredInvestment = false;

    try {
      const decimalInvest = Decimal(investmentAmount);
      hasEnteredInvestment = decimalInvest.gt(0);
    } catch (e) {
      //
    }

    if (
      !(marketSelections || []).some(
        ({ selectedOutcomeIndex }) => selectedOutcomeIndex > -1
      )
    ) {
      setStagedTradeAmounts(null);
      return;
    }

    try {
      const investmentAmountInUnits = collateral.toUnitsMultiplier.mul(
        hasEnteredInvestment ? investmentAmount : zeroDecimal
      );

      if (!investmentAmountInUnits.isInteger())
        throw new Error(
          `Got more than ${collateral.decimals} decimals in value ${investmentAmount}`
        );

      setStagedTradeAmounts(
        calcOutcomeTokenCounts(
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
    }
  }, [
    stagedTransactionType,
    positions,
    collateral,
    collateralBalance,
    lmsrState,
    investmentAmount,
    marketSelections
  ]);

  const forMarketIndex = 0; // TODO: Multiple scalar markets will break this
  const makeOutcomeSelectHandler = useCallback(
    outcomeIndex => () => {
      setStagedTransactionType("buy outcome tokens");
      setMarketSelections(prevValues =>
        prevValues.map((marketSelection, marketIndex) => {
          if (marketIndex === forMarketIndex) {
            return {
              selectedOutcomeIndex: outcomeIndex,
              isAssumed: false
            };
          }
          return marketSelection;
        })
      );
    },
    []
  );

  let hasAnyAllowance = false;
  let hasEnoughAllowance = false;
  if (lmsrAllowance != null) {
    try {
      hasAnyAllowance = lmsrAllowance.gtn(0);
      hasEnoughAllowance = collateral.toUnitsMultiplier
        .mul(investmentAmount || "0")
        .lte(lmsrAllowance.toString());
    } catch (e) {
      // empty
    }
  }

  const setInvestmentMax = useCallback(() => {
    if (collateralBalance != null && collateral != null) {
      setStagedTransactionType("buy outcome tokens");
      setInvestmentAmount(
        Decimal(collateralBalance.totalAmount.toString())
          .div(Math.pow(10, collateral.decimals))
          .toFixed(4)
      );
    }
  }, [collateralBalance, collateral]);

  const clearAllPositions = useCallback(() => {
    setStagedTransactionType(null);
    setStagedTradeAmounts(null);
    setInvestmentAmount("");
    resetMarketSelections(null);
    setError(null);
  }, [setStagedTradeAmounts, setInvestmentAmount, setError]);

  const buyOutcomeTokens = useCallback(async () => {
    if (stagedTradeAmounts == null) throw new Error(`No buy set yet`);

    if (stagedTransactionType !== "buy outcome tokens")
      throw new Error(
        `Can't buy outcome tokens while staged transaction is to ${stagedTransactionType}`
      );

    let investmentAmountInUnits;
    try {
      investmentAmountInUnits = collateral.toUnitsMultiplier.mul(
        investmentAmount
      );
    } catch (err) {
      investmentAmountInUnits = zeroDecimal;
    }

    if (investmentAmountInUnits.gt(collateralBalance.totalAmount.toString()))
      throw new Error(
        `Not enough collateral: missing ${formatCollateral(
          investmentAmountInUnits.sub(collateralBalance.totalAmount.toString()),
          collateral
        )}`
      );

    const tradeAmounts = stagedTradeAmounts.map(amount => amount.toString());
    const collateralLimit = await marketMakersRepo.calcNetCost(tradeAmounts);

    if (collateral.isWETH && collateralLimit.gt(collateralBalance.amount)) {
      await collateral.contract.deposit({
        value: collateralLimit.sub(collateralBalance.amount),
        from: account
      });
    }

    if (!hasAnyAllowance || !hasEnoughAllowance) {
      const marketMakerAddress = await marketMakersRepo.getAddress();
      await collateral.contract.approve(
        marketMakerAddress,
        maxUint256BN.toString(10),
        {
          from: account
        }
      );
    }

    await marketMakersRepo.trade(tradeAmounts, collateralLimit, account);

    clearAllPositions();
  }, [
    hasAnyAllowance,
    hasEnoughAllowance,
    stagedTransactionType,
    stagedTradeAmounts,
    marketMakersRepo,
    collateral,
    account
  ]);

  if (!probabilities) {
    return <Spinner />;
  }

  return (
    <div className={cx("buy")}>
      <div className={cx("selected-outcome")}>
        <label className={cx("fieldset-label")}>Pick Outcome</label>
        <div className={cx("outcomes")}>
          <button
            type="button"
            className={cx("outcome-button", {
              active: marketSelection.selectedOutcomeIndex === 0
            })}
            onClick={makeOutcomeSelectHandler(0)}
          >
            <i className={cx("icon", "icon-arrow-down")} /> Short
          </button>
          <button
            type="button"
            className={cx("outcome-button", {
              active: marketSelection.selectedOutcomeIndex === 1
            })}
            onClick={makeOutcomeSelectHandler(1)}
          >
            <i className={cx("icon", "icon-arrow-up")} /> Long
          </button>
        </div>
      </div>
      <div className={cx("selected-invest")}>
        <label className={cx("fieldset-label")}>Specify Amount</label>
        <div className={cx("input")}>
          <button
            type="button"
            className={cx("input-max")}
            onClick={setInvestmentMax}
          >
            MAX
          </button>
          <input
            type="text"
            className={cx("investment")}
            value={investmentAmount}
            onChange={e => {
              setStagedTransactionType("buy outcome tokens");
              setInvestmentAmount(e.target.value);
            }}
          />
          <span className={cx("input-right")}>
            {collateral.symbol}
          </span>
        </div>
      </div>
      <div className={cx("pl-sim")}>
        <div className={cx("desc")}>
          <label className={cx("fieldset-label")}>
            Profit/loss Simulator <small>(drag to slide)</small>
          </label>
          <p>Based on your current position</p>
        </div>
        <div className={cx("slider")}>
          <div className={cx("labels")}>
            <span>{formatScalarValue(market.lowerBound, market.unit)}</span>
            <span>
              {formatScalarValue(
                (market.upperBound - market.lowerBound) / 2 + market.lowerBound,
                market.unit
              )}
            </span>
            <span>{formatScalarValue(market.upperBound, market.unit)}</span>
          </div>
          <div className={cx("input")}>
            <input
              type="range"
              min={market.lowerBound}
              max={market.upperBound}
              defaultValue={sliderValue} /* uncontrolled for better UX */
              onInput={handleSliderChange}
            />
          </div>
        </div>
        <div className={cx("summary", "profit-loss-sim")}>
          <div className={cx("row")}>
            <span className={cx("label")}>Simulated Outcome</span>
            <span className={cx("spacer")} />
            <span className={cx("label")}>P/L &amp; payout</span>
          </div>
          <div className={cx("row")}>
            <span className={cx("value")}>
              {sliderValue.toFixed(market.decimals)} {market.unit}
            </span>
            <span className={cx("spacer")} />
            <span className={cx("value")}>
              {profitSim.percent}% ({profitSim.value})
            </span>
          </div>
        </div>
      </div>
      <div className={cx("invest-summary")}>
        <div className={cx("summary")}>
          <div className={cx("row")}>
            <span className={cx("label")}>Max Payout</span>
            <span className={cx("spacer")} />
            <span className={cx("value")}>123 DAI</span>
          </div>
          <div className={cx("row")}>
            <span className={cx("label")}>Max Loss</span>
            <span className={cx("spacer")} />
            <span className={cx("value")}>123 DAI</span>
          </div>
          <div className={cx("row")}>
            <span className={cx("label")}>Fees (0.5%)</span>
            <span className={cx("spacer")} />
            <span className={cx("value")}>0.00223 DAI</span>
          </div>
          <div className={cx("row")}>
            <span className={cx("label")}>Total Cost</span>
            <span className={cx("spacer")} />
            <span className={cx("value")}>123.23 DAI</span>
          </div>
        </div>
      </div>
      <div className={cx("invest-ctrls")}>
        {marketSelection.selectedOutcomeIndex > -1 && (
          <button
            className={cx("buy-button")}
            type="button"
            onClick={asWrappedTransaction(
              "buy outcome tokens",
              buyOutcomeTokens,
              setError
            )}
          >
            Buy {market.outcomes[marketSelection.selectedOutcomeIndex].title}{" "}
            Position
          </button>
        )}
      </div>
    </div>
  );
};

export default Buy;