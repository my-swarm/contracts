// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../token/SRC20.sol';
import '../factories/SRC20Registry.sol';
import '../interfaces/IPriceUSD.sol';

/**
 * @title TokenMinter
 * @dev Serves as proxy (manager) for SRC20 minting.
 * @dev To be called by the token issuer or fundraise.
 * The swm/src ratio comes from a price oracle
 * This contract is meant to be replaced if Swarm Governance decides to change
 * the fee structure of the protocol.
 */
contract TokenMinter {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IPriceUSD public SWMPriceOracle;
  address public swm;

  mapping(address => uint256) netAssetValue;

  constructor(address _swm, address _swmPriceOracle) {
    SWMPriceOracle = IPriceUSD(_swmPriceOracle);
    swm = _swm;
  }

  modifier onlyAuthorised(address _src20) {
    SRC20Registry registry = _getRegistry(_src20);

    require(
      SRC20(_src20).getMinter() == address(this),
      'TokenMinter: Not registered to mint token'
    );
    require(
      _src20 == msg.sender || registry.fundraise(_src20, msg.sender),
      'TokenMinter: Caller not authorized'
    );
    _;
  }

  /**
   *  Calculate how many SWM tokens need to be paid as fee to tokenize an asset
   *  @param _nav Tokenized Asset Value in USD
   *  @return the number of SWM tokens
   */
  function calcFee(uint256 _nav) public view returns (uint256) {
    uint256 feeUSD;

    // Up to 10,000 NAV the fee is flat at 1 SWM
    // We return zero because the rest of the values are calculated based on SWM price.
    if (_nav >= 0 && _nav <= 10000) feeUSD = 0;

    // From 10000K up to 1M fee is 0.5%
    if (_nav > 10000 && _nav <= 1000000) feeUSD = _nav.mul(5).div(1000);

    // From 1M up to 5M fee is 0.45%
    if (_nav > 1000000 && _nav <= 5000000) feeUSD = _nav.mul(45).div(10000);

    // From 5M up to 15M fee is 0.40%
    if (_nav > 5000000 && _nav <= 15000000) feeUSD = _nav.mul(4).div(1000);

    // From 15M up to 50M fee is 0.25%
    if (_nav > 15000000 && _nav <= 50000000) feeUSD = _nav.mul(25).div(10000);

    // From 50M up to 100M fee is 0.20%
    if (_nav > 50000000 && _nav <= 100000000) feeUSD = _nav.mul(2).div(1000);

    // From 100M up to 150M fee is 0.15%
    if (_nav > 100000000 && _nav <= 150000000) feeUSD = _nav.mul(15).div(10000);

    // From 150M up fee is 0.10%
    if (_nav > 150000000) feeUSD = _nav.mul(1).div(1000);

    // 0.04 is returned as (4, 100)
    (uint256 numerator, uint256 denominator) = SWMPriceOracle.getPrice();

    // 10**18 because we return Wei
    if (feeUSD != 0) {
      return feeUSD.mul(denominator).mul(10**18).div(numerator);
    } else {
      // User must pay one SWM
      return 1 ether;
    }
  }

  /**
   *  This function mints SRC20 tokens
   *  Only the SRC20 token or fundraiser can call this function
   *  Minter must be registered for the specific SRC20
   *
   *  @param _src20 The address of the SRC20 token to mint tokens for
   *  @param _recipient The address of the recipient
   *  @param _amount Number of SRC20 tokens to mint
   *  @return true on success
   */
  function mint(
    address _src20,
    address _recipient,
    uint256 _amount
  ) external onlyAuthorised(_src20) returns (bool) {
    uint256 swmAmount;

    if (SRC20(_src20).nav() > netAssetValue[_src20]) {
      uint256 navDifference = SRC20(_src20).nav().sub(netAssetValue[_src20]);
      swmAmount = calcFee(navDifference);
    }

    if (swmAmount != 0) {
      IERC20(swm).safeTransferFrom(SRC20(_src20).owner(), address(this), swmAmount);
      require(_applyFee(swm, swmAmount, _src20), 'TokenMinter: Fee application failed');
    }

    require(SRC20(_src20).executeMint(_recipient, _amount), 'TokenMinter: Token minting failed');

    netAssetValue[_src20] = SRC20(_src20).nav();

    return true;
  }

  function _applyFee(
    address _feeToken,
    uint256 _feeAmount,
    address _src20
  ) internal returns (bool) {
    SRC20Registry registry = _getRegistry(_src20);
    uint256 treasuryAmount = _feeAmount.mul(2).div(10);
    uint256 rewardAmount = _feeAmount.sub(treasuryAmount);
    address treasury = registry.treasury();
    address rewardPool = registry.rewardPool();

    IERC20(_feeToken).safeTransfer(treasury, treasuryAmount);
    IERC20(_feeToken).safeTransfer(rewardPool, rewardAmount);

    return true;
  }

  function _getRegistry(address _token) internal view returns (SRC20Registry) {
    return SRC20Registry(SRC20(_token).registry());
  }
}
