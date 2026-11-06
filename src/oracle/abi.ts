import { parseAbi } from "viem";

export const oracleAbi = parseAbi([
  "function price() view returns (uint256)",
  "function BASE_VAULT() view returns (address)",
  "function QUOTE_VAULT() view returns (address)",
  "function BASE_FEED_1() view returns (address)",
  "function BASE_FEED_2() view returns (address)",
  "function QUOTE_FEED_1() view returns (address)",
  "function QUOTE_FEED_2() view returns (address)",
  "function BASE_VAULT_CONVERSION_SAMPLE() view returns (uint256)",
  "function QUOTE_VAULT_CONVERSION_SAMPLE() view returns (uint256)",
  "function SCALE_FACTOR() view returns (uint256)"
]);

export const oracleFactoryAbi = parseAbi([
  "function isMorphoChainlinkOracleV2(address oracle) view returns (bool)"
]);

export const feedAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function latestTimestamp() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function typeAndVersion() view returns (string)",
  "function owner() view returns (address)",
  "function aggregator() view returns (address)",
  "function getFeedId() view returns (bytes32)"
]);

export const cacheAbi = parseAbi([
  "function owner() view returns (address)",
  "function typeAndVersion() view returns (string)",
  "function getForwarderAddress() view returns (address)",
  "function getAllowedWorkflowOwner() view returns (address)",
  "function latestAnswerForFeed(bytes32 feedId) view returns (uint256)",
  "function latestAnswerTimestampForFeed(bytes32 feedId) view returns (uint256)",
  "function isAllowedWorkflowId(bytes32 workflowId) view returns (bool)",
  "event AnswerUpdated(bytes32 indexed feedId, uint256 indexed timestamp, uint256 answer)",
  "event StaleReport(bytes32 indexed feedId, uint256 reportTimestamp, uint256 latestTimestamp)"
]);

export const forwarderAbi = parseAbi([
  "function owner() view returns (address)",
  "function typeAndVersion() view returns (string)",
  "event ReportProcessed(address indexed receiver, bytes32 indexed workflowExecutionId, bytes2 indexed reportId, bool result)"
]);
