import React, { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";
import Web3 from "web3";
import cn from "classnames/bind";
import Decimal from "decimal.js-light";
import { Query } from "react-apollo";

import Markdown from "react-markdown";

import style from "./marketTable.scss";
import ResolutionTime from "./ResolutionTime";
import Spinner from "components/Spinner";
import Graph from "components/Graph";

import { markdownRenderers } from "utils/markdown";
import { calcSelectedMarketProbabilitiesFromPositionProbabilities } from "utils/probabilities";
import { formatCollateral } from "utils/formatting";
import { getTrades } from "api/thegraph";

import prepareQueryData from "./utils/prepareQueryData";

const { BN } = Web3.utils;

const cx = cn.bind(style);

const MarketTable = ({
  markets,
  positions,
  lmsrState,
  marketSelections,
  setMarketSelections,
  resetMarketSelections,
  collateral
}) => {
  useEffect(() => {
    resetMarketSelections();
    return () => {
      setMarketSelections(null);
    };
  }, []);
  const [isExpanded, setExpanded] = useState(false);
  const [marketProbabilities, setMarketProbabilities] = useState(null);
  const handleToggleExpand = useCallback(() => {
    setExpanded(!isExpanded);
  }, [isExpanded]);

  useEffect(() => {
    if (lmsrState != null) {
      const { funding, positionBalances } = lmsrState;
      const invB = new Decimal(positionBalances.length)
        .ln()
        .div(funding.toString());

      const positionProbabilities = positionBalances.map(balance =>
        invB
          .mul(balance.toString())
          .neg()
          .exp()
      );
      const newMarketProbabilities = calcSelectedMarketProbabilitiesFromPositionProbabilities(
        markets,
        positions,
        marketSelections,
        positionProbabilities
      );
      setMarketProbabilities(newMarketProbabilities);
    }
  }, [lmsrState, markets, positions, marketSelections]);

  if (!lmsrState) {
    return <Spinner />;
  }

  return (
    <div className={cx("markettable")}>
      <Query query={getTrades}>
        {({ loading, error, data }) => {
          if (loading) return <Spinner width={32} height={32} />;
          if (error) throw new Error(error);

          return markets.map(
            (
              {
                conditionId,
                title,
                resolutionDate,
                dataSource,
                dataSourceUrl,
                lowerBound,
                upperBound,
                decimals,
                unit,
                description,
                type
              },
              index
            ) => {
              const trades = prepareQueryData(
                { lowerBound, upperBound, type },
                data,
                lmsrState.marketMakerAddress
              );

              const parsedProbabilities = marketProbabilities[index][1]
                .mul(upperBound - lowerBound)
                .add(lowerBound)
                .toNumber();

              // .map(
              //   (
              //     {
              //       conditionId,
              //       title,
              //       resolutionDate,
              //       dataSource,
              //       dataSourceUrl,
              //       lowerBound,
              //       upperBound,
              //       decimals,
              //       unit,
              //       description,
              //       trades
              //     },
              //     index
              //   ) => {
              return (
                <div
                  className={cx("markettable-row")}
                  key={`market-${conditionId}`}
                >
                  <div className={cx("header")}>{title}</div>
                  <div className={cx("subheader")}>
                    <div className={cx("property")}>
                      <i className={cx("icon", "icon-time")} />{" "}
                      <ResolutionTime date={resolutionDate} />
                    </div>
                    <div className={cx("property")}>
                      <i className={cx("icon", "icon-oracle")} /> Oracle Name
                    </div>
                    <div className={cx("property")}>
                      <i className={cx("icon", "icon-volume")} />{" "}
                      {formatCollateral(lmsrState.funding, collateral)}
                    </div>
                  </div>
                  <div className={cx("prediction")}>
                    <Graph
                      lowerBound={lowerBound}
                      upperBound={upperBound}
                      decimals={decimals}
                      unit={unit}
                      entries={trades}
                      queryData={data}
                      currentProbability={[parsedProbabilities]}
                      marketType={type}
                    />
                  </div>
                  <div className={cx("details")}>
                    <div className={cx("details-header")}>
                      <button
                        type="button"
                        className={cx("details-expand")}
                        onClick={handleToggleExpand}
                      >
                        Market Details
                        <span className={cx("expand-button")}>
                          {isExpanded ? "–" : "+"}
                        </span>
                      </button>
                    </div>
                    <div
                      className={cx("details-content", {
                        hidden: !isExpanded
                      })}
                    >
                      {dataSource && (
                        <>
                          <h1>Data Source</h1>
                          {dataSourceUrl ? (
                            <a
                              href={dataSourceUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {dataSource}
                            </a>
                          ) : (
                            <>{dataSource}</>
                          )}
                        </>
                      )}
                      <Markdown
                        className={cx("description")}
                        source={
                          description || "*No Description for this Market*"
                        }
                        renderers={markdownRenderers}
                      />
                    </div>
                  </div>
                </div>
              );
            }
          );
        }}
      </Query>
    </div>
  );
};

MarketTable.propTypes = {
  markets: PropTypes.arrayOf(
    PropTypes.shape({
      conditionId: PropTypes.string.isRequired
    }).isRequired
  ).isRequired,
  marketResolutionStates: PropTypes.array,
  positions: PropTypes.arrayOf(
    PropTypes.shape({
      positionIndex: PropTypes.number.isRequired,
      outcomes: PropTypes.arrayOf(
        PropTypes.shape({
          marketIndex: PropTypes.number.isRequired,
          outcomeIndex: PropTypes.number.isRequired
        }).isRequired
      ).isRequired
    }).isRequired
  ).isRequired,
  lmsrState: PropTypes.shape({
    funding: PropTypes.instanceOf(BN).isRequired,
    positionBalances: PropTypes.arrayOf(PropTypes.instanceOf(BN).isRequired)
      .isRequired
  }),
  marketSelections: PropTypes.arrayOf(
    PropTypes.shape({
      selectedOutcomeIndex: PropTypes.number,
      isAssumed: PropTypes.bool.isRequired
    }).isRequired
  ),
  resetMarketSelections: PropTypes.func.isRequired,
  setMarketSelections: PropTypes.func.isRequired,
  stagedTradeAmounts: PropTypes.arrayOf(
    PropTypes.instanceOf(Decimal).isRequired
  )
};

export default MarketTable;