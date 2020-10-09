pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';

/**
 * @title Whitelisted transfer restriction example
 * @dev Example of simple transfer rule, having a list
 * of whitelisted addresses manged by owner, and checking
 * that from and to address in src20 transfer are whitelisted.
 */
contract Whitelisted is Ownable {
  mapping(address => bool) public _whitelisted;

  event AccountWhitelisted(address account, address sender);
  event AccountUnWhitelisted(address account, address sender);

  function whitelistAccount(address _account) external onlyOwner {
    _whitelisted[_account] = true;
    emit AccountWhitelisted(_account, msg.sender);
  }

  function bulkWhitelistAccount(address[] calldata _accounts) external onlyOwner {
    for (uint256 i = 0; i < _accounts.length; i++) {
      address account = _accounts[i];
      _whitelisted[account] = true;
      emit AccountWhitelisted(account, msg.sender);
    }
  }

  function unWhitelistAccount(address _account) external onlyOwner {
    delete _whitelisted[_account];
    emit AccountUnWhitelisted(_account, msg.sender);
  }

  function bulkUnWhitelistAccount(address[] calldata _accounts) external onlyOwner {
    for (uint256 i = 0; i < _accounts.length; i++) {
      address account = _accounts[i];
      delete _whitelisted[account];
      emit AccountUnWhitelisted(account, msg.sender);
    }
  }

  function isWhitelisted(address _account) public view returns (bool) {
    return _whitelisted[_account];
  }
}
