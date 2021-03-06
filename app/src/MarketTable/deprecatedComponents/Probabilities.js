import React from "react";
import PropTypes from "prop-types";
import cn from "classnames/bind";

import style from "./probabilities.scss";
import { outcomeColors, probabilityDecimalPlaces } from "utils/constants";

import { formatProbability } from "utils/formatting";

const cx = cn.bind(style);

const Probabilities = ({ outcomes, probabilities, stagedProbabilities }) => {
  const displayedProbabilities = probabilities
    ? probabilities
    : stagedProbabilities;
  return (
    <div className={cx("probabilities")}>
      {displayedProbabilities && (
        <>
          {outcomes.map((outcome, index) => {
            const changeInProbability = (probabilities || stagedProbabilities)[
              index
            ]
              .sub(stagedProbabilities[index])
              .mul(100)
              .toDecimalPlaces(probabilityDecimalPlaces);
            return (
              <div
                className={cx("outcome-bar", {
                  "staged-display": changeInProbability.abs().gt(0.01)
                })}
                key={outcome.short}
              >
                <div
                  className={cx("probability")}
                  style={{
                    borderColor: outcomeColors[index].toString()
                  }}
                >
                  <div className={cx("label", "outcome")}>
                    <i className={cx("dot", index ? "no" : "yes")} />{" "}
                    <span>{outcome.title}</span>
                  </div>
                  <div
                    className={cx("bar")}
                    style={{
                      width: `${displayedProbabilities[index]
                        .mul(100)
                        .toString()}%`,
                      backgroundColor: outcomeColors[index].toString()
                    }}
                  />
                  <div className={cx("label", "amount")}>
                    {formatProbability(displayedProbabilities[index])}
                  </div>
                </div>

                {changeInProbability.abs().gt(0.01) && (
                  <span
                    className={cx("change-percentage", {
                      negative: changeInProbability.lt(0)
                    })}
                  >
                    {changeInProbability.toString()}%
                  </span>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

Probabilities.propTypes = {
  outcomes: PropTypes.arrayOf(PropTypes.object),
  probabilities: PropTypes.arrayOf(PropTypes.number),
  stagedProbabilities: PropTypes.arrayOf(PropTypes.object)
};

export default Probabilities;
