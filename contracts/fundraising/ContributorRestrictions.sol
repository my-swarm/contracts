pragma solidity ^0.5.0;

import '../interfaces/IContributorRestrictions.sol';
import '../rules/Whitelisted.sol';
import '../fundraising/Fundraiser.sol';
import '../roles/DelegateRole.sol';

/**
 * @title ContributorRestrictions
 *
 * Serves to implement all the various restrictions that a Fundraise can have.
 * A Fundraise contract always points to only one ContributorRestrictions contract.
 * The owner of the Fundraise contract sets up ContributorRestrictions contract at
 * the beginning of the fundraise.
 */
contract ContributorRestrictions is IContributorRestrictions, Whitelisted, DelegateRole {
  address fundraise;
  uint256 public maxCount;
  uint256 public minAmount;
  uint256 public maxAmount;

  modifier onlyAuthorised() {
    require(
      msg.sender == owner() || msg.sender == fundraise || _hasDelegate(msg.sender),
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
    fundraise = _fundraiser;
    maxCount = _maxCount;
    minAmount = _minAmount;
    maxAmount = _maxAmount;
  }

  function checkMinInvestment(uint256 _amount) public view returns (bool) {
    return minAmount == 0 ? true : _amount >= minAmount;
  }

  function checkMaxInvestment(uint256 _amount) public view returns (bool) {
    return maxAmount == 0 ? true : _amount <= maxAmount;
  }

  function checkMaxContributors() public view returns (bool) {
    return maxCount == 0 ? true : Fundraiser(fundraise).numContributors() < maxCount;
  }

  function checkRestrictions(address _account) external view returns (bool) {
    require(isWhitelisted(_account));
    require(checkMaxContributors());
    return true;
  }

  function whitelistAccount(address _account) external onlyAuthorised {
    _whitelisted[_account] = true;
    require(
      Fundraiser(fundraise).acceptContributor(_account),
      'Whitelisting failed on processing contributions!'
    );
    emit AccountWhitelisted(_account, msg.sender);
  }

  function unWhitelistAccount(address _account) external onlyAuthorised {
    delete _whitelisted[_account];
    require(
      Fundraiser(fundraise).removeContributor(_account),
      'UnWhitelisting failed on processing contributions!'
    );
    emit AccountUnWhitelisted(_account, msg.sender);
  }

  function bulkWhitelistAccount(address[] calldata _accounts) external onlyAuthorised {
    uint256 accLen = _accounts.length;
    for (uint256 i = 0; i < accLen; i++) {
      _whitelisted[_accounts[i]] = true;
      emit AccountWhitelisted(_accounts[i], msg.sender);
    }
  }

  function bulkUnWhitelistAccount(address[] calldata accounts) external onlyAuthorised {
    uint256 accLen = accounts.length;
    for (uint256 i = 0; i < accLen; i++) {
      delete _whitelisted[accounts[i]];
      emit AccountUnWhitelisted(accounts[i], msg.sender);
    }
  }
}
