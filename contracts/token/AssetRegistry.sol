pragma solidity ^0.5.0;

import '../interfaces/ISRC20Roles.sol';
import './SRC20.sol';
import '../interfaces/IAssetRegistry.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';

/**
 * AssetRegistry holds the real-world/offchain properties of the various Assets being tokenized.
 * It provides functions for getting/setting these properties.
 */
contract AssetRegistry is IAssetRegistry, Ownable {
  struct AssetType {
    bytes32 kyaHash;
    string kyaUrl;
    uint256 nav;
  }

  address public src20Factory;

  mapping(address => AssetType) public assetList;

  modifier onlyFactory() {
    require(src20Factory == msg.sender, 'Caller not factory');
    _;
  }

  modifier onlyDelegate(address _src20) {
    require(SRC20(_src20).roles().isDelegate(msg.sender), 'Caller not delegate');
    _;
  }

  constructor(address _src20Factory) public {
    src20Factory = _src20Factory;
  }

  /**
   * Add an asset to the AssetRegistry
   *
   * @param _src20 the token address.
   * @param _kyaHash SHA256 hash of KYA document.
   * @param _kyaUrl URL of token's KYA document (ipfs, http, etc.).
   *               or address(0) if no rules should be checked on chain.
   * @return True on success.
   */
  function addAsset(
    address _src20,
    bytes32 _kyaHash,
    string calldata _kyaUrl,
    uint256 _nav
  ) external onlyFactory returns (bool) {
    require(assetList[_src20].nav == 0, 'Asset already added, try update functions');

    assetList[_src20].kyaHash = _kyaHash;
    assetList[_src20].kyaUrl = _kyaUrl;
    assetList[_src20].nav = _nav;

    emit AssetAdded(_src20, _kyaHash, _kyaUrl, _nav);
    return true;
  }

  /**
   * Gets the currently valid Net Asset Value value for a token.
   *
   * @param _src20 the token address.
   * @return The current Net Asset Value of the token.
   */
  function getNav(address _src20) external view returns (uint256) {
    return assetList[_src20].nav;
  }

  /**
   * Sets the currently valid Net Asset Value value for a token.
   *
   * @param _src20 the token address.
   * @param _nav the new value we're setting
   * @return True on success.
   */
  function updateNav(address _src20, uint256 _nav) external onlyDelegate(_src20) returns (bool) {
    assetList[_src20].nav = _nav;
    emit NavUpdated(_src20, _nav);
    return true;
  }

  /**
   * Retrieve token's KYA document's hash and url.
   *
   * @param _src20 the token this applies to
   *
   * @return Hash of KYA document.
   * @return URL of KYA document.
   */
  function getKya(address _src20) public view returns (bytes32, string memory) {
    return (assetList[_src20].kyaHash, assetList[_src20].kyaUrl);
  }

  function getKyaHash(address _src20) public view returns (bytes32) {
    return assetList[_src20].kyaHash;
  }

  /**
   * @dev Update KYA document, sending document hash and url.
   * Hash is SHA256 hash of document content.
   * Emits KyaUpdated event.
   * Allowed to be called by owner's delegate only.
   *
   * @param _src20 the token this applies to.
   * @param _kyaHash SHA256 hash of KYA document.
   * @param _kyaUrl URL of token's KYA document (ipfs, http, etc.).
   *               or address(0) if no rules should be checked on chain.
   * @return True on success.
   */
  function updateKya(
    address _src20,
    bytes32 _kyaHash,
    string calldata _kyaUrl
  ) external onlyDelegate(_src20) returns (bool) {
    assetList[_src20].kyaHash = _kyaHash;
    assetList[_src20].kyaUrl = _kyaUrl;

    emit KyaUpdated(_src20, _kyaHash, _kyaUrl);
    return true;
  }
}
