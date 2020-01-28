import React, { useMemo } from "react";
import cn from "classnames/bind";

import style from "./resolved.scss";
import prepareTradesData from "utils/prepareTradesData";

const cx = cn.bind(style);

const Resolved = ({ markets, tradeHistory }) => {
  const targetMarket = markets[0];

  if (markets.length > 1) {
    return (
      <div className={cx("resolved")}>
        Resolution for multiple markets not yet implemented!
        <br />
        Contact Support
      </div>
    );
  }

  const fullyResolved = markets.every(market => market.winningOutcome != null);

  const tradeData = useMemo(
    () =>
      prepareTradesData(
        {
          lowerBound: targetMarket.lowerBound || 0,
          upperBound: targetMarket.upperBound || 100,
          type: targetMarket.type
        },
        tradeHistory
      ),
    [tradeHistory, markets[0]]
  );
  const lastTrade =
    tradeData.length > 0 ? tradeData[tradeData.length - 1] : null;

  return fullyResolved ? (
    <div className={cx("resolved")}>
      <p className={cx("resolve-entry", "winning-value")}>
        <span className={cx("label")}>Market resolved to:</span>
        <span className={cx("value")}>
          {targetMarket.winningOutcome}{" "}
          {targetMarket.type === "SCALAR" && (targetMarket.unit || "Units")}
        </span>
      </p>
      {targetMarket.type === "SCALAR" &&
        lastTrade &&
        lastTrade.outcomesProbability && (
          <p className={cx("resolve-entry", "last-trade")}>
            <span className={cx("label")}>Last trade on market:</span>
            <span className={cx("value")}>
              {lastTrade.outcomesProbability[0]} {targetMarket.unit || "Units"}
            </span>
          </p>
        )}
    </div>
  ) : (
    <div className={cx("resolved")}>
      <h1 className={cx("waiting-for-oracle")}>
        Market closed but no winning outcome was set yet. Please wait until the
        oracle has been resolved.
      </h1>
    </div>
  );
};

export default Resolved;