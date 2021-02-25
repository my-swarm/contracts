// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

/**
 * @title ITokenMinter
 * @dev The interface for TokenMinter, proxy (manager) for SRC20 minting.
 */
interface ITokenMinter {
  function calcFee(uint256 nav) external view returns (uint256);

  function mint(
    address src20,
    address recipitent,
    uint256 amount
  ) external returns (bool);
}
