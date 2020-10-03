pragma solidity ^0.5.0;

/**
 * AssetRegistry holds the real-world/offchain properties of the various Assets being tokenized.
 * It provides functions for getting/setting these properties.
 */
interface IAssetRegistry {
  event AssetAdded(address indexed src20, bytes32 kyaHash, string kyaUrl, uint256 AssetValueUSD);
  event AssetNVAUSDUpdated(address indexed src20, uint256 AssetValueUSD);
  event AssetKYAUpdated(address indexed src20, bytes32 kyaHash, string kyaUrl);

  function addAsset(
    address src20,
    bytes32 kyaHash,
    string calldata kyaUrl,
    uint256 netAssetValueUSD
  ) external returns (bool);

  function getNetAssetValueUSD(address src20) external view returns (uint256);

  function updateNetAssetValueUSD(address src20, uint256 netAssetValueUSD) external returns (bool);

  function getKYA(address src20) external view returns (bytes32 kyaHash, string memory kyaUrl);

  function getKYAHash(address src20) external view returns (bytes32);

  function updateKYA(
    address src20,
    bytes32 kyaHash,
    string calldata kyaUrl
  ) external returns (bool);
}
