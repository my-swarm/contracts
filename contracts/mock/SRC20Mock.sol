pragma solidity ^0.5.0;

import '../token/SRC20.sol';

/**
 * @title SRC20Mock contract
 * @dev SRC20 mock contract for tests.
 */
contract SRC20Mock is SRC20 {
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _maxTotalSupply,
    address[] memory _addressList,
    //  addressList[0] rules,
    //  addressList[1] roles,
    //  addressList[2] features,
    //  addressList[3] assetRegistry
    uint256 _totalSupply
  ) public SRC20(msg.sender, _name, _symbol, _decimals, _maxTotalSupply, _addressList) {
    totalSupply = _totalSupply;
    balances[_addressList[0]] = _totalSupply;
  }
}
