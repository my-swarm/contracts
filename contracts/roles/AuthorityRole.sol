pragma solidity ^0.5.0;

import '@openzeppelin/contracts/access/Roles.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';

/**
 * @title AuthorityRole
 * @dev Authority is roles responsible for signing/approving token transfers
 * on-chain & off-chain
 */
contract AuthorityRole {
  using Roles for Roles.Role;

  event AuthorityAdded(address indexed account);
  event AuthorityRemoved(address indexed account);

  Roles.Role private authorities;

  function _addAuthority(address _account) internal {
    authorities.add(_account);
    emit AuthorityAdded(_account);
  }

  function _removeAuthority(address _account) internal {
    authorities.remove(_account);
    emit AuthorityRemoved(_account);
  }

  function _hasAuthority(address _account) internal view returns (bool) {
    return authorities.has(_account);
  }
}
