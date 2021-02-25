// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract MockERC20 is ERC20 {
  uint8 private _decimals;

  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) public ERC20(name_, symbol_) {
    _decimals = decimals_;
  }

  function mint(address account, uint256 amount) public {
    _mint(account, amount);
  }
}
