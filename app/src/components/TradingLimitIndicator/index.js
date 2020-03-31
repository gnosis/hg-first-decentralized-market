import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import cn from "classnames/bind";

import { getCurrentTradingVolume } from "api/onboarding";

import LinearProgress from "@material-ui/core/LinearProgress";
import InputLabel from "@material-ui/core/InputLabel";

import style from "./tradingLimitIndicator.scss";

const cx = cn.bind(style);

// MIN = Minimum expected value
// MAX = Maximium expected value
// Function to normalise the values (MIN / MAX could be integrated)
const normalise = (value, min, max) => ((value - min) * 100) / (max - min);

const TradingLimitIndicator = ({ openModal, address, userState, tiers }) => {
  const [volume, setVolume] = useState(0);
  const [maxVolume, setMaxVolume] = useState(0);
  const [tier, setTier] = useState(0)

  const getTradingVolume = useCallback(() => {
    (async () => {
      const { buyVolume } = await getCurrentTradingVolume(address);

      console.log(buyVolume);

      setVolume(buyVolume.dollars);
    })();
  }, [getCurrentTradingVolume, address]);

  useEffect(() => {
    getTradingVolume();
  }, [address]);

  useEffect(() => {
    if (tiers && userState.tiers) {
      const tiersKeys = Object.keys(userState.tiers);
      const userTier = tiersKeys.reduce((acc, key) => {
        if (userState.tiers[key].status === "ENABLED") {
          return key;
        }
        return acc;
      }, {});

      tiers.forEach(tier => {
        if ("tier" + tier.name === userTier) {
          setMaxVolume(tier.limit);
          setTier(tier.name);
        }
      });

      console.log(maxVolume);
    }
  }, [tiers, userState]);

  return (
    <div
      className={cx("trading-indicator")}
      onClick={() =>
        openModal("tradeOverLimit", {
          address,
          tier,
          volume,
          maxVolume,
          tradeValue: 12,
          openModal
        })
      }
    >
      <LinearProgress
        variant="determinate"
        value={normalise(volume, 0, maxVolume)}
        classes={{
          root: cx("linear-progress"),
          barColorPrimary: cx("linear-progress-bar")
        }}
      />
      <div className={cx("progress-label")}>
        <span>
          ${volume} / <strong>${maxVolume}</strong>
        </span>
      </div>
      <InputLabel
        classes={{
          root: cx("indicator-label")
        }}
      >
        Tier {tier}
      </InputLabel>
    </div>
  );
};

TradingLimitIndicator.propTypes = {
  address: PropTypes.string,
  tiers: PropTypes.array,
  userState: PropTypes.shape({
    tiers: PropTypes.shape({})
  }),
  openModal: PropTypes.func.isRequired
};

export default TradingLimitIndicator;
