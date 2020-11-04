pragma solidity ^0.5.0;

//import '@nomiclabs/buidler/console.sol';

import '../interfaces/IContributorRestrictions.sol';
import '../rules/Whitelisted.sol';
import '../fundraising/Fundraiser.sol';
import '../roles/DelegateRole.sol';

/**
 * @title ContributorRestrictions
 *
 * Various restrictions that a Fundraiser can have.
 * Each Fundraiser contract points to one. Issuer sets it up when setting u fundraiser.
 */
contract ContributorRestrictions is IContributorRestrictions, Whitelisted, DelegateRole {
  address fundraiser;
  uint256 public maxCount;
  uint256 public minAmount;
  uint256 public maxAmount;

  modifier onlyAuthorised() {
    require(
      msg.sender == owner() || msg.sender == fundraiser || _hasDelegate(msg.sender),
      'ContributorRestrictions: caller is not authorised'
    );
    _;
  }

  constructor(
    address _fundraiser,
    uint256 _maxCount,
    uint256 _minAmount,
    uint256 _maxAmount
  ) public Ownable() {
    require(_maxAmount >= _minAmount, 'Maximum amount has to be >= minInvestmentAmount');
    fundraiser = _fundraiser;
    maxCount = _maxCount;
    minAmount = _minAmount;
    maxAmount = _maxAmount;
  }

  function checkMinInvestment(uint256 _amount) public view returns (bool) {
    return minAmount == 0 || _amount >= minAmount;
  }

  function checkMaxInvestment(uint256 _amount) public view returns (bool) {
    return maxAmount == 0 || _amount <= maxAmount;
  }

  function checkMaxContributors() public view returns (bool) {
    return maxCount == 0 || Fundraiser(fundraiser).numContributors() < maxCount;
  }

  function checkRestrictions(address _account) external view returns (bool) {
    require(isWhitelisted(_account));
    require(checkMaxContributors());
    return true;
  }

  function whitelistAccount(address _account) external onlyAuthorised {
    whitelisted[_account] = true;
    require(
      Fundraiser(fundraiser).acceptContributor(_account),
      'Whitelisting failed on processing contributions!'
    );
    emit AccountWhitelisted(_account, msg.sender);
  }

  function unWhitelistAccount(address _account) external onlyAuthorised {
    delete whitelisted[_account];
    require(
      Fundraiser(fundraiser).removeContributor(_account),
      'UnWhitelisting failed on processing contributions!'
    );
    emit AccountUnWhitelisted(_account, msg.sender);
  }

  // todo: this wasn't automatically accepting contributors. Sad!
  function bulkWhitelistAccount(address[] calldata _accounts) external onlyAuthorised {
    uint256 accLen = _accounts.length;
    for (uint256 i = 0; i < accLen; i++) {
      whitelisted[_accounts[i]] = true;
      require(
        Fundraiser(fundraiser).acceptContributor(_accounts[i]),
        'Whitelisting failed on processing contributions!'
      );
      emit AccountWhitelisted(_accounts[i], msg.sender);
    }
  }

  function bulkUnWhitelistAccount(address[] calldata _accounts) external onlyAuthorised {
    require(false, 'Bulk unwhitelist not imlemented');
    uint256 accLen = _accounts.length;
    for (uint256 i = 0; i < accLen; i++) {
      delete whitelisted[_accounts[i]];
      emit AccountUnWhitelisted(_accounts[i], msg.sender);
    }
  }
}
