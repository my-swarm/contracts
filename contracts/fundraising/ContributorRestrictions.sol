pragma solidity ^0.5.0;

import '../interfaces/IContributorRestrictions.sol';
import '../fundraising/ContributorWhitelist.sol';
import '../fundraising/SwarmPoweredFundraise.sol';
import '../roles/DelegateRole.sol';

/**
 * @title ContributorRestrictions
 *
 * Serves to implement all the various restrictions that a Fundraise can have.
 * A Fundraise contract always points to only one ContributorRestrictions contract.
 * The owner of the Fundraise contract sets up ContributorRestrictions contract at
 * the beginning of the fundraise.
 */
contract ContributorRestrictions is IContributorRestrictions, ContributorWhitelist, DelegateRole {
  address fundraise;
  uint256 public maxContributors;
  uint256 public minInvestmentAmount;
  uint256 public maxInvestmentAmount;

  modifier onlyAuthorised() {
    require(
      msg.sender == owner() || msg.sender == fundraise || _hasDelegate(msg.sender),
      'ContributorRestrictions: caller is not authorised'
    );
    _;
  }

  constructor(
    address fundraiseContract,
    uint256 maxNumContributors,
    uint256 minAmount,
    uint256 maxAmount
  ) public Ownable() {
    require(maxAmount >= minAmount, 'Maximum amount has to be >= minInvestmentAmount');
    fundraise = fundraiseContract;
    maxContributors = maxNumContributors;
    minInvestmentAmount = minAmount;
    maxInvestmentAmount = maxAmount;
  }

  function checkMinInvestment(uint256 amount) public view returns (bool) {
    return minInvestmentAmount == 0 ? true : amount >= minInvestmentAmount;
  }

  function checkMaxInvestment(uint256 amount) public view returns (bool) {
    return maxInvestmentAmount == 0 ? true : amount <= maxInvestmentAmount;
  }

  function checkMaxContributors() public view returns (bool) {
    return
      maxContributors == 0
        ? true
        : SwarmPoweredFundraise(fundraise).numberOfContributors() < maxContributors;
  }

  function checkRestrictions(address account) external view returns (bool) {
    require(isWhitelisted(account));
    require(checkMaxContributors());
    return true;
  }

  function whitelistAccount(address account) external onlyAuthorised {
    _whitelisted[account] = true;
    require(
      SwarmPoweredFundraise(fundraise).acceptContributor(account),
      'Whitelisting failed on processing contributions!'
    );
    emit AccountWhitelisted(account, msg.sender);
  }

  function unWhitelistAccount(address account) external onlyAuthorised {
    delete _whitelisted[account];
    require(
      SwarmPoweredFundraise(fundraise).removeContributor(account),
      'UnWhitelisting failed on processing contributions!'
    );
    emit AccountUnWhitelisted(account, msg.sender);
  }

  function bulkWhitelistAccount(address[] calldata accounts) external onlyAuthorised {
    uint256 accLen = accounts.length;
    for (uint256 i = 0; i < accLen; i++) {
      _whitelisted[accounts[i]] = true;
      emit AccountWhitelisted(accounts[i], msg.sender);
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
