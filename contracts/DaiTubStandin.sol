pragma solidity ^0.5.1;

import { IDaiTub } from "./DaiStabilityFeeOracle.sol";

contract DaiTubStandin is IDaiTub {
    function fee() external view returns (uint) {
        // 1.175^(1/(60*60*24*365)) rounded to 27 decimal places
        // corresponds to a 17.5% stability fee
        return 1000000005113779426955452540;
    }
}
