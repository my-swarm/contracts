pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';


/**
 * @title The Fundraise Manager
 */
contract FundraiserManager is Ownable {
  using SafeMath for uint256;

  event ExpirationTimeChanged(uint256 expirationTime);
  event FeeChanged(uint256 fee);

  uint256 public expirationTime;
  uint256 public fee; // USDC has 6 decimal places

  constructor(uint256 _expirationTime, uint256 _fee) public {
    expirationTime = _expirationTime;
    fee = _fee;
  }

  function setExpirationTime(uint256 _time) external onlyOwner returns (uint256) {
    expirationTime = _time;
    emit ExpirationTimeChanged(expirationTime);
    return expirationTime;
  }

  function setFee(uint256 _fee) external onlyOwner returns (uint256) {
    fee = _fee;
    emit FeeChanged(fee);
    return fee;
  }
}
