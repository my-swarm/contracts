pragma solidity ^0.5.0;

/**
 * @dev Interface for SRC20 Registry contract
 */
contract ISRC20Registry {
  event FactoryAdded(address account);
  event FactoryRemoved(address account);
  event SRC20Registered(address token, address tokenOwner);
  event SRC20Removed(address token);
  event MinterAdded(address minter);
  event MinterRemoved(address minter);

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

  function put(
    address token,
    address roles,
    address tokenOwner,
    address minter
  ) external returns (bool);

  function remove(address token) external returns (bool);

  function contains(address token) external view returns (bool);

  function addMinter(address minter) external returns (bool);

  function getMinter(address src20) external view returns (address);

  function removeMinter(address minter) external returns (bool);

  function addFactory(address account) external returns (bool);

  function removeFactory(address account) external returns (bool);

  function renounceManagement(address src20) external returns (bool);

  function transferManagement(address src20, address newManager) external returns (bool);

  function getStake(address src20) external view returns (uint256);

  function computeStake(address src20, uint256 src20Amount) external view returns (uint256);

  function getTokenOwner(address src20) external view returns (address);
}
