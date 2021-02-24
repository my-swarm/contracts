// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.7.0;

/**
 * @title Freezable account
 * @dev Base contract providing internal methods for freezing,
 * unfreezing and checking accounts' status.
 */
contract Freezable {
  mapping(address => bool) private frozen;

  event AccountFrozen(address indexed account);
  event AccountUnfrozen(address indexed account);

  /**
   * @dev Freeze an account
   */
  function _freezeAccount(address _account) internal {
    frozen[_account] = true;
    emit AccountFrozen(_account);
  }

  /**
   * @dev Unfreeze an account
   */
  function _unfreezeAccount(address _account) internal {
    frozen[_account] = false;
    emit AccountUnfrozen(_account);
  }

  /**
   * @dev Check if an account is frozen. If token is frozen, all
   * of accounts are frozen also.
   * @return bool
   */
  function _isAccountFrozen(address _account) internal view returns (bool) {
    return frozen[_account];
  }
}
