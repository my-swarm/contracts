pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '../interfaces/ISRC20Registry.sol';
import '../interfaces/INetAssetValueUSD.sol';
import '../interfaces/IPriceUSD.sol';
import '../interfaces/ISRC20.sol';
import '@nomiclabs/buidler/console.sol';

/**
 * @title TokenMinter
 * @dev Serves as proxy (manager) for SRC20 minting/burning.
 * @dev To be called by the token issuer.
 * The swm/src ratio comes from an oracle and the stake amount from the staking table.f
 */
contract TokenMinter {
  ISRC20Registry public registry;
  INetAssetValueUSD public asset;
  IPriceUSD public SWMPriceOracle;

  using SafeMath for uint256;

  constructor(
    address _registry,
    address _asset,
    address _swmRate
  ) public {
    registry = ISRC20Registry(_registry);
    asset = INetAssetValueUSD(_asset);
    SWMPriceOracle = IPriceUSD(_swmRate);
  }

  modifier onlyTokenOwner(address _src20) {
    require(
      msg.sender == Ownable(_src20).owner() || msg.sender == ISRC20(_src20).fundraiser(),
      'caller not token owner'
    );
    _;
  }

  /**
   *  Calculate how many SWM tokens need to be staked to tokenize an asset
   *  This function is custom for each TokenMinter contract
   *  Specification: https://docs.google.com/document/d/1Z-XuTxGf5LQudO5QLmnSnD-k3nTb0tlu3QViHbOSQXo/
   *
   *  Note: The stake requirement depends only on the asset USD value and USD/SWM exchange rate (SWM price).
   *        It doesn't depend on the number of tokens to be minted!
   *
   *  @param _nav Tokenized Asset Value in USD
   *  @return the number of SWM tokens
   */
  function calcStake(uint256 _nav) public view returns (uint256) {
    uint256 stakeUSD;

    // Up to 500,000 NAV the stake is flat at 2,500 USD
    if (_nav >= 0 && _nav <= 500000) stakeUSD = 2500;

    // From 500K up to 1M stake is 0.5%
    if (_nav > 500000 && _nav <= 1000000) stakeUSD = _nav.mul(5).div(1000);

    // From 1M up to 5M stake is 0.45%
    if (_nav > 1000000 && _nav <= 5000000) stakeUSD = _nav.mul(45).div(10000);

    // From 5M up to 15M stake is 0.40%
    if (_nav > 5000000 && _nav <= 15000000) stakeUSD = _nav.mul(4).div(1000);

    // From 15M up to 50M stake is 0.25%
    if (_nav > 15000000 && _nav <= 50000000) stakeUSD = _nav.mul(25).div(10000);

    // From 50M up to 100M stake is 0.20%
    if (_nav > 50000000 && _nav <= 100000000) stakeUSD = _nav.mul(2).div(1000);

    // From 100M up to 150M stake is 0.15%
    if (_nav > 100000000 && _nav <= 150000000) stakeUSD = _nav.mul(15).div(10000);

    // From 150M up stake is 0.10%
    if (_nav > 150000000) stakeUSD = _nav.mul(1).div(1000);

    // 0.04 is returned as (4, 100)
    (uint256 numerator, uint256 denominator) = SWMPriceOracle.getPrice();

    // 10**18 because we return Wei
    return stakeUSD.mul(denominator).div(numerator).mul(10**18);
  } /// fn calcStake

  /**
   *  This proxy function calls the SRC20Registry function that will do two things
   *  Note: prior to this, the msg.sender has to call approve() on the SWM ERC20 contract
   *        and allow the Manager to withdraw SWM tokens
   *  1. Withdraw the SWM tokens that are required for staking
   *  2. Mint the SRC20 tokens
   *  Only the Owner of the SRC20 token can call this function
   *
   *  @param _src20 The address of the SRC20 token to mint tokens for
   *  @param _src20Amount Number of SRC20 tokens to mint
   *  @return true on success
   */
  function stakeAndMint(address _src20, uint256 _src20Amount)
    external
    onlyTokenOwner(_src20)
    returns (bool)
  {
    uint256 swmAmount = calcStake(asset.getNav(_src20));

    if (msg.sender == ISRC20(_src20).fundraiser()) {
      console.log('StakeAndMint fundraiser');
      require(
        registry.mintSupply(_src20, Ownable(_src20).owner(), swmAmount, _src20Amount),
        'supply minting failed'
      );
    } else {
      console.log('StakeAndMint NOT fundraiser');
      require(
        registry.mintSupply(_src20, msg.sender, swmAmount, _src20Amount),
        'supply minting failed'
      );
    }

    return true;
  }
}
