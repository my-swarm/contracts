// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

interface IERC20 {
  function transfer(address to, uint256 value) external returns (bool);

  function transferFrom(
    address from,
    address to,
    uint256 value
  ) external returns (bool);
}

contract Disperse {
  function disperseEther(address payable[] calldata _recipients, uint256[] calldata _values)
    external
    payable
  {
    for (uint256 i = 0; i < _recipients.length; i++) _recipients[i].transfer(_values[i]);
    uint256 balance = address(this).balance;
    if (balance > 0) msg.sender.transfer(balance);
  }

  function disperseToken(
    IERC20 _token,
    address[] calldata _recipients,
    uint256[] calldata _values
  ) external {
    uint256 total = 0;
    for (uint256 i = 0; i < _recipients.length; i++) total += _values[i];
    require(_token.transferFrom(msg.sender, address(this), total));
    for (uint256 i = 0; i < _recipients.length; i++)
      require(_token.transfer(_recipients[i], _values[i]));
  }

  function disperseTokenSimple(
    IERC20 _token,
    address[] calldata _recipients,
    uint256[] calldata _values
  ) external {
    for (uint256 i = 0; i < _recipients.length; i++)
      require(_token.transferFrom(msg.sender, _recipients[i], _values[i]));
  }
}
