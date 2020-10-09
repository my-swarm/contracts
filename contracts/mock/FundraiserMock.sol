pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '../fundraising/Fundraiser.sol';
import '../fundraising/ContributorRestrictions.sol';

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract FundraiserMock is Fundraiser {
  using SafeMath for uint256;

  // array

  constructor(
    string memory _label,
    address _src20,
    uint256 _SRC20tokenSupply,
    uint256 _startDate,
    uint256 _endDate,
    uint256 _softCapBCY,
    uint256 _hardCapBCY
  )
    public
    Fundraiser(_label, _src20, _SRC20tokenSupply, _startDate, _endDate, _softCapBCY, _hardCapBCY)
  {}

  function getQualifiedContributions(address contributor) public view returns (uint256) {
    return qualifiedContributions[contributor];
  }

  function getBufferedContributions(address contributor) public view returns (uint256) {
    return pendingContributions[contributor];
  }

  function getBalanceToken(address contributor) public view returns (uint256) {
    return qualifiedContributions[contributor] + pendingContributions[contributor];
  }

  function acceptContribution(address contributor) external pure returns (bool) {
    address c;
    c = contributor;
    return true;
  }

  function rejectContribution(address contributor) external pure returns (bool) {
    address c;
    c = contributor;
    return true;
  }

  function setNumContributorsToMax() external {
    numContributors = ContributorRestrictions(contributorRestrictions).maxCount();
  }
}
