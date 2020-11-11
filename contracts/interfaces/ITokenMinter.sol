pragma solidity ^0.5.10;

/**
 * @title ITokenMinter
 * @dev Interface to TokenMinter, proxy (manager) for SRC20 minting/burning.
 */
interface ITokenMinter {
  function calcStake(uint256 netAssetValueUSD) external view returns (uint256);

  function stakeAndMint(address src20, uint256 numSRC20Tokens) external returns (bool);
}
