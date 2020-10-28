pragma solidity ^0.5.0;

/**
 * @dev Manager handles SRC20 burn/mint in relation to
 * SWM token staking.
 */
interface IManager {
  event SRC20SupplyIncreased(
    address src20,
    address swmAccount,
    uint256 swmAmount,
    uint256 src20Amount
  );
  event SRC20SupplyDecreased(
    address src20,
    address swmAccount,
    uint256 swmAmount,
    uint256 src20Amount
  );

  function mintSupply(
    address src20,
    address swmAccount,
    uint256 swmAmount,
    uint256 src20Amount
  ) external returns (bool);

  function increaseSupply(
    address src20,
    address swmAccount,
    uint256 src20Amount
  ) external returns (bool);

  function decreaseSupply(
    address src20,
    address swmAccount,
    uint256 src20Amount
  ) external returns (bool);

  function renounceManagement(address src20) external returns (bool);

  function transferManagement(address src20, address newManager) external returns (bool);

  function calcTokens(address src20, uint256 swmAmount) external view returns (uint256);

  function getStake(address src20) external view returns (uint256);

  function swmNeeded(address src20, uint256 src20Amount) external view returns (uint256);

  function getSrc20toSwmRatio(address src20) external returns (uint256);

  function getTokenOwner(address src20) external view returns (address);
}
