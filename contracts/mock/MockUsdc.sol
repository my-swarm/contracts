// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockUsdc is ERC20 {
  uint8 private _decimals;

  constructor() public ERC20('Mock USDC', 'USDC') {
    _decimals = 6;
  }

  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }
}
