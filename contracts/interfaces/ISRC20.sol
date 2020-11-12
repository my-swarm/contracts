pragma solidity ^0.5.0;

/**
 * @title SRC20 public interface
 */
interface ISRC20 {
  event TransferRulesUpdated(address transferRrules);

  function executeTransfer(
    address from,
    address to,
    uint256 value
  ) external returns (bool);

  function updateTransferRules(address transferRules) external returns (bool);

  // ERC20 part-like interface
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);

  function totalSupply() external view returns (uint256);

  function balanceOf(address who) external view returns (uint256);

  function allowance(address owner, address spender) external view returns (uint256);

  function approve(address spender, uint256 value) external returns (bool);

  function transfer(address to, uint256 value) external returns (bool);

  function transferFrom(
    address from,
    address to,
    uint256 value
  ) external returns (bool);

  function increaseAllowance(address spender, uint256 value) external returns (bool);

  function decreaseAllowance(address spender, uint256 value) external returns (bool);

  function setFundraiser() external returns (bool);

  function fundraiser() external returns (address);
}
