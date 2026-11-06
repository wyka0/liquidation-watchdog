import { parseAbi } from "viem";
// Read-only subset of IMorpho v1.0.0. Named static tuples are wire-compatible
// with the flattened public mapping getters in IMorphoStaticTyping.
export const morphoAbi = parseAbi([
    "struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }",
    "struct Market { uint128 totalSupplyAssets; uint128 totalSupplyShares; uint128 totalBorrowAssets; uint128 totalBorrowShares; uint128 lastUpdate; uint128 fee; }",
    "struct Position { uint256 supplyShares; uint128 borrowShares; uint128 collateral; }",
    "function idToMarketParams(bytes32 id) view returns (MarketParams params)",
    "function market(bytes32 id) view returns (Market m)",
    "function position(bytes32 id, address account) view returns (Position p)",
    "function isIrmEnabled(address irm) view returns (bool)",
    "function isLltvEnabled(uint256 lltv) view returns (bool)"
]);
export const irmAbi = parseAbi([
    "struct MarketParams { address loanToken; address collateralToken; address oracle; address irm; uint256 lltv; }",
    "struct Market { uint128 totalSupplyAssets; uint128 totalSupplyShares; uint128 totalBorrowAssets; uint128 totalBorrowShares; uint128 lastUpdate; uint128 fee; }",
    "function borrowRateView(MarketParams marketParams, Market market) view returns (uint256)"
]);
export const tokenAbi = parseAbi([
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
]);
//# sourceMappingURL=abi.js.map