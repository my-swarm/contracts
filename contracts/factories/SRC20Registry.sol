pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/access/Roles.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/ISRC20Registry.sol';
import '../interfaces/ISRC20.sol';
import '../interfaces/ISRC20Managed.sol';
import '../interfaces/ISRC20Roles.sol';

/**
 * @dev SRC20 registry contains the address of every created
 * SRC20 token. Registered factories can add addresses of
 * new tokens, public can query tokens.
 */
contract SRC20Registry is ISRC20Registry, Ownable {
  using Roles for Roles.Role;
  using SafeMath for uint256;

  Roles.Role private factories;
  IERC20 private swmERC20;

  struct SRC20Record {
    address owner;
    address roles;
    uint256 stake;
    address minter;
  }

  mapping(address => bool) authorizedMinters;
  mapping(address => SRC20Record) internal registry;

  modifier onlyTokenOwner(address _src20) {
    require(_isTokenOwner(_src20), 'Caller not token owner.');
    _;
  }

  // Note that, similarly to the role of token owner, there is only one manager per src20 token contract.
  // Only one address can have this role.
  modifier onlyMinter(address _src20) {
    require(msg.sender == registry[_src20].minter, 'Caller not token minter.');
    _;
  }

  /**
   * @dev constructor requiring SWM ERC20 contract address.
   */
  constructor(address _swmERC20) public {
    require(_swmERC20 != address(0), 'SWM ERC20 is zero address');

    swmERC20 = IERC20(_swmERC20);
  }

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
   *  @param _minter The address of the minters contract to add to the list of authorized minters
   *  @return true on success
   */
  function addMinter(address _minter) external onlyOwner returns (bool) {
    require(_minter != address(0), 'minter is zero address');

    authorizedMinters[_minter] = true;

    emit MinterAdded(_minter);

    return true;
  }

  /**
   * @dev Checks if registry has a minters registered
   * @param _minter The minters contract address.
   */
  function hasMinter(address _minter) external view returns (bool) {
    return authorizedMinters[_minter] == true;
  }

  /**
   *  With this function you can fetch address of authorized minters for SRC20.
   *
   *  @param _src20 Address of SRC20 token we want to check minters for.
   *  @return address of authorized minters.
   */
  function getMinter(address _src20) external view returns (address) {
    return registry[_src20].minter;
  }

  /**
   *  This proxy function removes a contract from the list of authorized minters
   *
   *  @param _minter The address of the minters contract to remove from the list of authorized minters
   *  @return true on success
   */
  function removeMinter(address _minter) external onlyOwner returns (bool) {
    require(_minter != address(0), 'minter is zero address');

    authorizedMinters[_minter] = false;

    emit MinterRemoved(_minter);

    return true;
  }

  /**
   * @dev External view function to get current SWM stake
   *
   * @param _token Address of SRC20 token contract
   * @return Current stake in wei SWM tokens
   */
  function getStake(address _token) external view returns (uint256) {
    return registry[_token].stake;
  }

  /**
   * @dev Get address of token owner
   *
   * @param _token Address of SRC20 token contract
   * @return Address of token owner
   */
  function getTokenOwner(address _token) external view returns (address) {
    return registry[_token].owner;
  }

  /**
   * @dev Get address of roles contract
   *
   * @param _token Address of SRC20 token contract
   * @return Address of roles contract
   */
  function getRoles(address _token) external view returns (address) {
    return registry[_token].roles;
  }

  /**
   * @dev Mint SRC20 tokens and increase stake. To be called by a minter only, not token owner (see increseSupply for that)
   *
   * Used primarily for initial stake&mint or additional mint by a minter.
   * The registry maintains SWM/SRC20 amounts for subsequent increaseSupply/decreaseSupply calls.
   * Only owner of this contract can invoke this method. Owner is SWARM controlled
   * address.
   * Emits SRC20SupplyMinted event.
   *
   * @param _src20 SRC20 token address.
   * @param _swmAccount SWM ERC20 account holding enough SWM tokens (>= swmAmount)
   * with manager contract address approved to transferFrom.
   * @param _swmAmount SWM stake value.
   * @param _src20Amount SRC20 tokens to mint
   * @return true on success.
   */
  function mintSupply(
    address _src20,
    address _swmAccount,
    uint256 _swmAmount,
    uint256 _src20Amount
  ) external onlyMinter(_src20) returns (bool) {
    require(_swmAccount != address(0), 'SWM account address is zero');
    require(_swmAmount != 0, 'SWM amount is zero');
    require(_src20Amount != 0, 'SRC20 amount is zero');
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    return _increaseSupply(_src20, _swmAccount, _swmAmount, _src20Amount);
  }

  /**
   * @dev This is function token issuer can call in order to increase his SRC20 supply this
   * and stake his tokens. The src20/swm ratio is kept the same as in the initial stake&mint.
   *
   * @param _src20 Address of src20 token contract
   * @param _swmAccount Account from which stake tokens are going to be deducted
   * @param _src20Amount Value of desired SRC20 token value
   * @return true if success
   */
  function increaseSupply(
    address _src20,
    address _swmAccount,
    uint256 _src20Amount
  ) external onlyTokenOwner(_src20) returns (bool) {
    require(_swmAccount != address(0), 'SWM account is zero');
    require(_src20Amount != 0, 'SWM amount is zero');
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    uint256 swmAmount = _computeStake(_src20, _src20Amount);
    return _increaseSupply(_src20, _swmAccount, swmAmount, _src20Amount);
  }

  /**
   * @dev This is function token issuer can call in order to decrease his SRC20 supply
   * and his stake back
   *
   * @param _src20 Address of src20 token contract
   * @param _swmAccount Account to which stake tokens will be returned
   * @param _src20Amount Value of desired SRC20 token value
   * @return true if success
   */
  function decreaseSupply(
    address _src20,
    address _swmAccount,
    uint256 _src20Amount
  ) external onlyTokenOwner(_src20) returns (bool) {
    require(_swmAccount != address(0), 'SWM account is zero');
    require(_src20Amount != 0, 'SWM amount is zero');
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    uint256 swmAmount = _computeStake(_src20, _src20Amount);
    return _decreaseSupply(_src20, _swmAccount, swmAmount, _src20Amount);
  }

  /**
   * @dev Allows manager to renounce management.
   *
   * @param _src20 SRC20 token address.
   * @return true on success.
   */
  function renounceManagement(address _src20) external onlyOwner returns (bool) {
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    require(ISRC20Roles(registry[_src20].roles).renounceManagement());

    return true;
  }

  /**
   * @dev Allows manager to transfer management to another address.
   *
   * @param _src20 SRC20 token address.
   * @param _newManager New manager address.
   * @return true on success.
   */
  function transferManagement(address _src20, address _newManager) public onlyOwner returns (bool) {
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');
    require(_newManager != address(0), 'newManager address is zero');

    require(ISRC20Roles(registry[_src20].roles).transferManagement(_newManager));

    return true;
  }

  /**
   * @dev External view function for calculating SWM tokens needed for increasing/decreasing
   * src20 token supply.
   *
   * @param _src20 Address of src20 contract
   * @param _src20Amount Amount of src20 tokens.this
   * @return Amount of SWM tokens
   */
  function computeStake(address _src20, uint256 _src20Amount) external view returns (uint256) {
    return _computeStake(_src20, _src20Amount);
  }

  function _increaseSupply(
    address _src20,
    address _swmAccount,
    uint256 _swmAmount,
    uint256 _src20Amount
  ) internal returns (bool) {
    require(swmERC20.transferFrom(_swmAccount, address(this), _swmAmount));
    require(ISRC20Managed(_src20).mint(registry[_src20].owner, _src20Amount));
    registry[_src20].stake = registry[_src20].stake.add(_swmAmount);

    emit SRC20SupplyIncreased(_src20, _swmAccount, _swmAmount, _src20Amount);

    return true;
  }

  function _decreaseSupply(
    address _src20,
    address _swmAccount,
    uint256 _swmAmount,
    uint256 _src20Amount
  ) internal returns (bool) {
    require(swmERC20.transfer(_swmAccount, _swmAmount));
    require(ISRC20Managed(_src20).burn(registry[_src20].owner, _src20Amount));
    registry[_src20].stake = registry[_src20].stake.sub(_swmAmount);

    emit SRC20SupplyDecreased(_src20, _swmAccount, _swmAmount, _src20Amount);

    return true;
  }

  function _computeStake(address _src20, uint256 _src20Amount) internal view returns (uint256) {
    uint256 totalSupply = ISRC20(_src20).totalSupply();
    return _src20Amount.mul(registry[_src20].stake).div(totalSupply);
  }

  /**
   * @return true if `msg.sender` is the token owner of the registered SRC20 contract.
   */
  function _isTokenOwner(address _src20) internal view returns (bool) {
    return msg.sender == registry[_src20].owner;
  }
}
