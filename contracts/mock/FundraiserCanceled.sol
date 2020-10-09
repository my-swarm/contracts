pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '../fundraising/Fundraiser.sol';

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract FundraiserCanceled is Fundraiser {
  using SafeMath for uint256;
  // array
  bool isOngoing = false;
  bool isFinished = false;
  bool isCanceled = true;

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
