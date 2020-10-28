pragma solidity ^0.5.0;
import '@nomiclabs/buidler/console.sol';
import '../token/SRC20.sol';
import '../interfaces/ISRC20Registry.sol';
import '../token/AssetRegistry.sol';

/**
 * @dev Factory that creates SRC20 token with requested token
 * properties and features.
 */
contract SRC20Factory {
  ISRC20Registry private _registry;

  event SRC20Created(
    address owner,
    address token,
    address transferRules,
    address features,
    string name,
    string symbol,
    uint8 decimals,
    uint256 maxTotalSupply
  );

  /**
   * @dev Factory constructor expects SRC20 tokens registry.
   * Each created token will be registered in registry.
   * @param registry address of SRC20Registry contract.
   */
  constructor(address registry) public {
    _registry = ISRC20Registry(registry);
  }

  /**
   * Creates new SRC20 contract. Expects token properties and
   * desired capabilities of the token. Only SRC20Factory owner an call
   * this function.
   * Emits SRC20Created event with address of new token.
   * @dev The address list has to be constructed according to the
   * definition provided in the comments.
   * @dev Array is used to avoid "stack too deep" error
   *
   * addressList[0]: tokenOwner,
   * addressList[1]: restrictions,
   * addressList[2]: rules,
   * addressList[3]: roles,
   * addressList[4]: features,
   * addressList[5]: assetRegistry,
   * addressList[6]: minter
   */
  function create(
    string memory name,
    string memory symbol,
    uint8 decimals,
    uint256 maxTotalSupply,
    bytes32 kyaHash,
    string memory kyaUrl,
    uint256 netAssetValueUSD,
    address[] memory addressList
  ) public returns (bool) {
    address token = address(new SRC20(name, symbol, decimals, maxTotalSupply, addressList));

    _registry.put(
      token,
      addressList[3], // roles
      addressList[0], // tokenOwner
      addressList[6] // minter
    );

    emit SRC20Created(
      addressList[0],
      token,
      addressList[2],
      addressList[4],
      name,
      symbol,
      decimals,
      maxTotalSupply
    );
    IAssetRegistry(addressList[5]).addAsset(token, kyaHash, kyaUrl, netAssetValueUSD);
    return true;
  }
}
