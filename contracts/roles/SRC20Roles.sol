pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import './DelegateRole.sol';
import './AuthorityRole.sol';
import './Managed.sol';
import '../interfaces/ISRC20Roles.sol';

/*
 * @title SRC20Roles contract
 * @dev Roles wrapper contract around all roles needed for SRC20 contract.
 */
contract SRC20Roles is ISRC20Roles, DelegateRole, AuthorityRole, Managed, Ownable {
  constructor(
    address _owner,
    address _manager,
    address _transferRules
  ) public Managed(_manager) {
    // todo: why not just get owner from msg.sender
    _transferOwnership(_owner);
    _addDelegate(_owner);
    if (_transferRules != address(0)) _addAuthority(_transferRules);
  }

  function addAuthority(address _account) external onlyOwner returns (bool) {
    _addAuthority(_account);
    return true;
  }

  function removeAuthority(address _account) external onlyOwner returns (bool) {
    _removeAuthority(_account);
    return true;
  }

  function isAuthority(address _account) external view returns (bool) {
    return _hasAuthority(_account);
  }

  function addDelegate(address _account) external onlyOwner returns (bool) {
    _addDelegate(_account);
    return true;
  }

  function removeDelegate(address _account) external onlyOwner returns (bool) {
    _removeDelegate(_account);
    return true;
  }

  function isDelegate(address _account) external view returns (bool) {
    // todo: owner automatically a delegate? makes sense to me...
    return isOwner() || _hasDelegate(_account);
  }

  function isManager(address _account) external view returns (bool) {
    return _isManager(_account);
  }

  function renounceManagement() external onlyManager returns (bool) {
    _renounceManagement();
    return true;
  }

  function transferManagement(address _newManager) external onlyManager returns (bool) {
    _transferManagement(_newManager);
    return true;
  }
}
