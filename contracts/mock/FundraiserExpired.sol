pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '../fundraising/Fundraiser.sol';

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract FundraiserExpired is Fundraiser {
  using SafeMath for uint256;
  // array

  bool isOngoing = true;
  bool isFinished = false;
  uint256 public endDate = 1573044338;
  uint256 public expiryPeriod = 7890000; // ~3 months in seconds

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

  function() external payable {
    revert();
  }
}
