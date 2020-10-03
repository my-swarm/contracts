pragma solidity ^0.5.0;

import '../token/SRC20.sol';

/**
 * @title SRC20Mock contract
 * @dev SRC20 mock contract for tests.
 */
contract SRC20Mock is SRC20 {
  uint256 private _totalSupply;
  uint256 private _maxTotalSupply;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals,
    uint256 maxTotalSupply,
    address[] memory addressList,
    //  addressList[0] tokenOwner,
    //  addressList[1] restrictions,
    //  addressList[2] rules,
    //  addressList[3] roles,
    //  addressList[4] featured,
    //  addressList[5] assetRegistry
    uint256 totalSupply
  ) public SRC20(name, symbol, decimals, maxTotalSupply, addressList) {
    _totalSupply = totalSupply;
    _balances[addressList[0]] = _totalSupply;
  }
}
