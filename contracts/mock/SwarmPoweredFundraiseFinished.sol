pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../fundraising/SwarmPoweredFundraise.sol";

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract SwarmPoweredFundraiseFinished is SwarmPoweredFundraise {

    using SafeMath for uint256;
    // array

    //bool isOngoing = false;
    //bool isFinished = true;

    constructor(
        string memory _label,
        address _src20,
        uint256 _SRC20tokenSupply,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _softCapBCY,
        uint256 _hardCapBCY
    )
    SwarmPoweredFundraise
    (
        _label,
        _src20,
        _SRC20tokenSupply,
        _startDate,
        _endDate,
        _softCapBCY,
        _hardCapBCY
    )
    public
    {
        isFinished = true;
        setupCompleted = true;
    }

    // function() external payable {
    //     revert();
    // }
    function forceFinish() public {
        isFinished = true;
    }

    function getBalanceToken(address token, uint256 amount) public pure returns (uint256) {
        address t; t = token;
        uint256 a; a = amount;
        return 0;
    }

    function claimTokens() external returns (bool) {
        return true;
    }
}
