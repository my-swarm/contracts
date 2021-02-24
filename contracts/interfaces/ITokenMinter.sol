pragma solidity ^0.5.10;

/**
 * @title ITokenMinter
 * @dev Interface to TokenMinter, proxy (manager) for SRC20 minting.
 */
interface ITokenMinter {
  function calcFee(uint256 nav) external view returns (uint256);

  function mint(
    address src20,
    address recipitent,
    uint256 amount
  ) external returns (bool);
}
