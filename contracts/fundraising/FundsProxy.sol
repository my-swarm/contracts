pragma solidity ^0.5.10;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FundsProxy {

  using SafeMath for uint;

  address fundRaiser;
  address baseCurrency = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; //USDC Mainnet

  modifier onlyFundraise() {
    require(msg.sender == fundRaiser, "!FundRaiser");
    _;
  }

  constructor (address _fundRaiser) public {
    fundRaiser = _fundRaiser;
  }

  function claimFunds(uint amount) external onlyFundraise returns (bool) {
    IERC20(baseCurrency).transfer(msg.sender, amount);
  }

}
