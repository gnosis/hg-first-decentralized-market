import ConditionalTokensService from "./ConditionalTokensService";
import getMarketMakersRepo from "../../repositories/MarketMakersRepo";
import getConditionalTokensRepo from "../../repositories/ConditionalTokensRepo";

let instance, instancePromise, lmsrAddressCache, providerAccountCache;

async function _getInstance({
  lmsrAddress,
  web3,
  account,
  collateralTokenAddress
}) {
  return Promise.all([
    getMarketMakersRepo({ lmsrAddress, web3, account, collateralTokenAddress }),
    getConditionalTokensRepo({
      lmsrAddress,
      web3,
      account,
      collateralTokenAddress
    })
  ]).then(
    ([marketMakersRepo, conditionalTokensRepo]) =>
      new ConditionalTokensService({
        marketMakersRepo,
        conditionalTokensRepo,
        web3
      })
  );
}

// When changing the market maker we have to reset the singleton
function _resetService() {
  instance = undefined;
  instancePromise = undefined;
}

export default async props => {
  if (
    props &&
    ((props.lmsrAddress && props.lmsrAddress !== lmsrAddressCache) ||
      props.account !== providerAccountCache)
  ) {
    // If marketMakerAddress changes we have to reload contracts
    _resetService();
  }

  if (!instance) {
    lmsrAddressCache = props.lmsrAddress;
    providerAccountCache = props.account;
    if (!instancePromise) {
      instancePromise = _getInstance(props);
    }

    instance = instancePromise;
  }

  return instance;
};
