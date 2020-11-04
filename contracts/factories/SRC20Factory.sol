pragma solidity ^0.5.0;
import '../token/SRC20.sol';
import '../interfaces/ISRC20Registry.sol';
import '../token/AssetRegistry.sol';

/**
 * @dev Factory that creates SRC20 token with requested token
 * properties and features.
 */
contract SRC20Factory {
  ISRC20Registry private registry;

  event SRC20Created(
    address owner,
    address token,
    address transferRules,
    address roles,
    address features,
    string name,
    string symbol,
    uint8 decimals,
    uint256 maxTotalSupply
  );

  /**
   * @dev Factory constructor expects SRC20 tokens registry.
   * Each created token will be registered in registry.
   * @param _registry address of SRC20Registry contract.
   */
  constructor(address _registry) public {
    registry = ISRC20Registry(_registry);
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
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _maxTotalSupply,
    bytes32 _kyaHash,
    string memory _kyaUrl,
    uint256 _netAssetValueUSD,
    address[] memory _addressList
  ) public returns (bool) {
    address token = address(new SRC20(_name, _symbol, _decimals, _maxTotalSupply, _addressList));

    registry.put(
      token,
      _addressList[3], // roles
      _addressList[0], // tokenOwner
      _addressList[6] // minter
    );

    emit SRC20Created(
      _addressList[0],
      token,
      _addressList[2],
      _addressList[3],
      _addressList[4],
      _name,
      _symbol,
      _decimals,
      _maxTotalSupply
    );
    IAssetRegistry(_addressList[5]).addAsset(token, _kyaHash, _kyaUrl, _netAssetValueUSD);
    return true;
  }
}
