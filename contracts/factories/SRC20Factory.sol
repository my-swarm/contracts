// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import '../token/SRC20.sol';
import './SRC20Registry.sol';

/**
 * @dev Factory that creates SRC20 token with requested token
 * properties and features.
 */
contract SRC20Factory {
  SRC20Registry public registry;

  event SRC20Created(
    address owner,
    address token,
    string name,
    string symbol,
    uint256 maxTotalSupply
  );

  /**
   * @dev Factory constructor expects the SRC20 tokens registry.
   * Each created token must be registered.
   * @param _registry The address of SRC20Registry contract.
   */
  constructor(address _registry) {
    registry = SRC20Registry(_registry);
  }

  function create(
    address _owner,
    string memory _name,
    string memory _symbol,
    uint256 _maxTotalSupply,
    bytes32 _kyaCid,
    uint256 _netAssetValueUSD,
    uint8 _features,
    address _minter
  ) public returns (bool) {
    address token = address(
      new SRC20(_owner, _name, _symbol, _maxTotalSupply, _features, address(registry))
    );

    registry.register(token, _minter);

    SRC20(token).updateKya(_kyaCid);
    SRC20(token).updateNav(_netAssetValueUSD);

    emit SRC20Created(msg.sender, token, _name, _symbol, _maxTotalSupply);
    return true;
  }
}
