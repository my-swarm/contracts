pragma solidity ^0.5.0;

import '@openzeppelin/contracts/access/Roles.sol';

/**
 * @title DelegateRole
 * @dev Delegate is accounts allowed to do certain operations on
 * contract, apart from owner.
 */
contract DelegateRole {
  using Roles for Roles.Role;

  event DelegateAdded(address indexed account);
  event DelegateRemoved(address indexed account);

  Roles.Role private delegates;

  function _addDelegate(address _account) internal {
    delegates.add(_account);
    emit DelegateAdded(_account);
  }

  function _removeDelegate(address _account) internal {
    delegates.remove(_account);
    emit DelegateRemoved(_account);
  }

  function _hasDelegate(address _account) internal view returns (bool) {
    return delegates.has(_account);
  }
}
