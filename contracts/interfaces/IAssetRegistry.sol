pragma solidity ^0.5.0;

/**
 * AssetRegistry holds the real-world/offchain properties of the various Assets being tokenized.
 * It provides functions for getting/setting these properties.
 */
interface IAssetRegistry {
  event AssetAdded(address indexed src20, bytes32 kyaHash, string kyaUrl, uint256 nav);
  event NavUpdated(address indexed src20, uint256 nav);
  event KyaUpdated(address indexed src20, bytes32 kyaHash, string kyaUrl);

  function addAsset(
    address src20,
    bytes32 kyaHash,
    string calldata kyaUrl,
    uint256 nav
  ) external returns (bool);

  function getNav(address src20) external view returns (uint256);

  function updateNav(address src20, uint256 nav) external returns (bool);

  function getKya(address src20) external view returns (bytes32 kyaHash, string memory kyaUrl);

  function getKyaHash(address src20) external view returns (bytes32);

  function updateKya(
    address src20,
    bytes32 kyaHash,
    string calldata kyaUrl
  ) external returns (bool);
}
