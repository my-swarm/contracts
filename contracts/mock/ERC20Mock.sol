pragma solidity ^0.5.0;

import '@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol';

contract ERC20Mock is ERC20Detailed, ERC20Mintable {
  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals,
    uint256 supply
  ) public ERC20Detailed(name, symbol, decimals) {
    mint(msg.sender, supply);
  }
}
