pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/access/Roles.sol';
import './Manager.sol';
import '../interfaces/ISRC20Registry.sol';

/**
 * @dev SRC20 registry contains the address of every created
 * SRC20 token. Registered factories can add addresses of
 * new tokens, public can query tokens.
 */
contract SRC20Registry is ISRC20Registry, Manager {
  using Roles for Roles.Role;

  Roles.Role private factories;
  mapping(address => bool) authorizedMinters;

  /**
   * @dev constructor requiring SWM ERC20 contract address.
   */
  constructor(address swmERC20) public Manager(swmERC20) {}

  /**
   * @dev Adds new factory that can register token.
   * Emits FactoryAdded event.
   *
   * @param _account The factory contract address.
   * @return True on success.
   */
  function addFactory(address _account) external onlyOwner returns (bool) {
    require(_account != address(0), 'account is zero address');

    factories.add(_account);

    emit FactoryAdded(_account);

    return true;
  }

  /**
   * @dev Removes factory that can register token.
   * Emits FactoryRemoved event.
   *
   * @param _account The factory contract address.
   * @return True on success.
   */
  function removeFactory(address _account) external onlyOwner returns (bool) {
    require(_account != address(0), 'account is zero address');

    factories.remove(_account);

    emit FactoryRemoved(_account);

    return true;
  }

  /**
   * @dev Checks if registry has a factory registered
   * @param _account The factory contract address.
   */
  function hasFactory(address _account) external view returns (bool) {
    return factories.has(_account);
  }

  /**
   * @dev Adds token to registry. Only factories can add.
   * Emits SRC20Registered event.
   *
   * @param _token The token address.
   * @param _roles roles SRC20Roles contract address.
   * @param _tokenOwner Owner of the token.
   * @return true on success.
   */
  function put(
    address _token,
    address _roles,
    address _tokenOwner,
    address _minter
  ) external returns (bool) {
    require(_token != address(0), 'token is zero address');
    require(_roles != address(0), 'roles is zero address');
    require(_tokenOwner != address(0), 'tokenOwner is zero address');
    require(factories.has(msg.sender), 'factory not registered');
    require(authorizedMinters[_minter] == true, 'minter not authorized');

    registry[_token].owner = _tokenOwner;
    registry[_token].roles = _roles;
    registry[_token].minter = _minter;

    emit SRC20Registered(_token, _tokenOwner);

    return true;
  }

  /**
   * @dev Removes token from registry.
   * Emits SRC20Removed event.
   *
   * @param _token The token address.
   * @return True on success.
   */
  function remove(address _token) external onlyOwner returns (bool) {
    require(_token != address(0), 'token is zero address');
    require(registry[_token].owner != address(0), 'token not registered');

    delete registry[_token];

    emit SRC20Removed(_token);

    return true;
  }

  /**
   * @dev Checks if registry contains token.
   *
   * @param _token The token address.
   * @return True if registry contains token.
   */
  function contains(address _token) external view returns (bool) {
    return registry[_token].owner != address(0);
  }

  /**
   *  This proxy function adds a contract to the list of authorized minters
   *
   *  @param _minter The address of the minter contract to add to the list of authorized minters
   *  @return true on success
   */
  function addMinter(address _minter) external onlyOwner returns (bool) {
    require(_minter != address(0), 'minter is zero address');

    authorizedMinters[_minter] = true;

    emit MinterAdded(_minter);

    return true;
  }

  /**
   * @dev Checks if registry has a minter registered
   * @param _minter The minter contract address.
   */
  function hasMinter(address _minter) external view returns (bool) {
    return authorizedMinters[_minter] == true;
  }

  /**
   *  With this function you can fetch address of authorized minter for SRC20.
   *
   *  @param _src20 Address of SRC20 token we want to check minters for.
   *  @return address of authorized minter.
   */
  function getMinter(address _src20) external view returns (address) {
    return registry[_src20].minter;
  }

  /**
   *  This proxy function removes a contract from the list of authorized minters
   *
   *  @param _minter The address of the minter contract to remove from the list of authorized minters
   *  @return true on success
   */
  function removeMinter(address _minter) external onlyOwner returns (bool) {
    require(_minter != address(0), 'minter is zero address');

    authorizedMinters[_minter] = false;

    emit MinterRemoved(_minter);

    return true;
  }
}
