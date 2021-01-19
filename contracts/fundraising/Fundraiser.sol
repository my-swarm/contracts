pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol';

import '../interfaces/ITokenMinter.sol';
import '../interfaces/IContributorRestrictions.sol';
import '../interfaces/ISRC20.sol';
import '../token/SRC20.sol';
import './FundraiserManager.sol';
import './AffiliateManager.sol';

import '@nomiclabs/buidler/console.sol';

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract Fundraiser {
  using SafeMath for uint256;

  event FundraiserCreated(
    string label,
    address token,
    uint256 supply,
    uint256 startDate,
    uint256 endDate,
    uint256 softCap,
    uint256 hardCap
  );

  event FundraiserSetup(
    address baseCurrency,
    uint256 tokenPrice,
    address affiliateManager,
    address contributorRestrictions,
    address fundraiserManager,
    address minter,
    bool contributionsLocked
  );
  event FundraiserCanceled();
  event FundraiserFinished();

  event ContributorAccepted(address account);
  event ContributorRemoved(address account, bool forced);

  // new pending contribution added (by unqualified user)
  event ContributionPending(address indexed account, uint256 amount);
  // new qualified contribution added (by qualified user)
  event ContributionAdded(address indexed account, uint256 amount);
  // pending contribution converted to qualified
  event PendingContributionAccepted(address indexed account, uint256 amount);

  event ContributionRefunded(address indexed account, uint256 amount);

  event TokensClaimed(address indexed account, uint256 amount);
  event Withdrawn(address indexed account, uint256 amount);
  event ReferralClaimed(address indexed account, uint256 amount);
  event FeePaid(address indexed account, uint256 amount);

  address private owner;

  // from constructor
  string public label;
  address public token;
  uint256 public supply;
  uint256 public startDate;
  uint256 public endDate;
  uint256 public softCap;
  uint256 public hardCap;

  // from setup
  address public baseCurrency;
  uint256 public tokenPrice;
  address public affiliateManager;
  address public contributorRestrictions;
  address public minter;
  address public fundraiserManager;
  bool public contributionsLocked = true;

  // state
  uint256 public numContributors = 0;
  uint256 public amountQualified = 0;
  uint256 public amountPending = 0;
  uint256 public amountWithdrawn = 0;
  uint256 public totalFeePaid = 0;

  bool public isFinished = false;
  bool public isCanceled = false;
  bool public isSetup = false;
  bool public isHardcapReached = false;

  // per contributor, these are contributors that have not been whitelisted yet
  mapping(address => uint256) public pendingContributions;

  // per whitelisted contributor, qualified amount
  // a qualified amount is an amount that has passed min/max checks
  mapping(address => uint256) public qualifiedContributions;

  // contributors who has been whitelisted and contributed funds
  mapping(address => bool) public contributors;

  // contributor to affiliate address mapping
  mapping(address => address) public contributorAffiliates;

  // affil share per affiliate. how much an affiliate gets
  mapping(address => uint256) public affiliateShares;

  // affil share per contributor. we need this to be able to revert given contributors part of affiliate share
  mapping(address => uint256) public contributorShares;

  modifier onlyOwner() {
    require(msg.sender == owner, 'Caller is not the owner!');
    _;
  }

  modifier onlyContributorRestrictions {
    require(msg.sender == contributorRestrictions, 'Caller not Contributor Restrictions contract!');
    _;
  }

  modifier onlyAcceptedCurrencies(address currency) {
    require(currency == baseCurrency, 'Unsupported contribution currency');
    _;
  }

  modifier ongoing {
    _ongoing();
    _;
  }

  /**
   *  Pass all the most important parameters that define the Fundraise
   *  All variables cannot be in the constructor because we get "stack too deep" error
   *  After deployment setup() function needs to be called to set them up
   */
  constructor(
    string memory _label,
    address _token,
    uint256 _supply,
    uint256 _startDate,
    uint256 _endDate,
    uint256 _softCap,
    uint256 _hardCap
  ) public {
    require(_hardCap >= _softCap, 'Hardcap has to be >= Softcap');
    require(_endDate > _startDate, 'End date has to be after start date');
    owner = msg.sender;
    label = _label;
    token = _token;
    supply = _supply;
    startDate = _startDate;
    endDate = _endDate;
    softCap = _softCap;
    hardCap = _hardCap;

    emit FundraiserCreated(label, token, supply, startDate, endDate, softCap, hardCap);
  }

  /**
   *  Set up additional parameters that didn't fit in the constructor
   *  All variables cannot be in the constructor because we get "stack too deep" error
   *  NOTE : If tokenPrice is not zero, supply is ignored
   */
  function setup(
    address _baseCurrency,
    uint256 _tokenPrice,
    address _affiliateManager,
    address _contributorRestrictions,
    address _fundraiserManager,
    address _minter,
    bool _contributionsLocked
  ) external onlyOwner() {
    require(_tokenPrice > 0 || supply > 0, 'Either price or amount to mint is needed');
    require(!isSetup, 'Contract is already set up');
    require(!isCanceled, 'Fundraiser is canceled');
    // I think this is a bullshit condition that makes testing ver annoying
    // I don't see a reason for this as long as setup is a condition for contributions and other actions
    // which it is by the ongoing modifier
    // require(block.timestamp < startDate, 'Set up should be done before start date');

    ISRC20(token).setFundraiser();

    baseCurrency = _baseCurrency;
    if (supply == 0) {
      tokenPrice = _tokenPrice;
    }
    affiliateManager = _affiliateManager;
    contributorRestrictions = _contributorRestrictions;
    fundraiserManager = _fundraiserManager;
    contributionsLocked = _contributionsLocked;
    minter = _minter;
    isSetup = true;

    emit FundraiserSetup(
      baseCurrency,
      tokenPrice,
      affiliateManager,
      contributorRestrictions,
      fundraiserManager,
      minter,
      contributionsLocked
    );
  }

  /**
   *  Cancel the fundraise. Can be done by the Token Issuer at any time
   *  The contributions are then available to be withdrawn by contributors
   *
   *  @return true on success
   */
  function cancel() external onlyOwner() returns (bool) {
    require(!isFinished, 'Fundraiser: Cannot cancel when finished.');

    isCanceled = true;
    contributionsLocked = false;
    emit FundraiserCanceled();
    return true;
  }

  /**
   *  contribute funds with an affiliate link
   *
   *  @param _amount the amount of the contribution
   *  @param _referral (optional) affiliate link used
   *  @return true on success
   */
  function contribute(uint256 _amount, string calldata _referral) external ongoing returns (bool) {
    require(_amount != 0, 'Fundraiser: cannot contribute 0');

    require(
      IERC20(baseCurrency).transferFrom(msg.sender, address(this), _amount),
      'ERC20 transfer failed'
    );

    _contribute(msg.sender, _amount, _referral);
    return true;
  }

  /**
   *  Once a contributor has been Whitelisted, this function gets called to
   *  process his buffered/pending transaction
   *
   *  @param _contributor the contributor we want to add
   *  @return true on success
   */
  function acceptContributor(address _contributor)
    external
    ongoing
    onlyContributorRestrictions
    returns (bool)
  {
    uint256 amount = pendingContributions[_contributor];
    // process contribution
    if (amount != 0) {
      pendingContributions[_contributor] = 0;
      amountPending = amountPending.sub(amount);
      string memory referral = '';
      if (affiliateManager != address(0)) {
        referral = AffiliateManager(affiliateManager).getReferral(
          contributorAffiliates[_contributor]
        );
      }
      uint256 realAmount = _contribute(_contributor, amount, referral);
      emit PendingContributionAccepted(_contributor, amount);
    }
    emit ContributorAccepted(_contributor);
    return true;
  }

  /**
   *  Removes a contributor (his contributions)
   *  This function can only be called by the
   *  restrictions/whitelisting contract
   *
   *  @param _contributor the contributor we want to remove
   *  @return true on success
   */
  function removeContributor(address _contributor)
    external
    ongoing
    onlyContributorRestrictions
    returns (bool)
  {
    _removeContributor(_contributor);
    if (affiliateManager != address(0)) {
      _removeShare(_contributor);
    }
    _fullRefund(_contributor);
    emit ContributorRemoved(_contributor, true);
    return true;
  }

  /**
   *  Allows contributor to get refunds of the amounts he contributed, if
   *  various conditions are met
   *
   *  @return true on success
   */
  function getRefund() external returns (bool) {
    bool isExpired = block.timestamp >
      endDate.add(FundraiserManager(fundraiserManager).expirationTime());
    require(
      isCanceled || isExpired || !contributionsLocked,
      'Condition for refund not met (event canceled, expired or contributions not locked)!'
    );
    require(_fullRefund(msg.sender), 'There are no funds to refund');
    _removeContributor(msg.sender);
    _removeShare(msg.sender);
    emit ContributorRemoved(msg.sender, false);
    return true;
  }

  /**
   *  Stake and Mint
   *  SWM has to be on the fundraise contract
   *
   *  @return true on success
   */
  function stakeAndMint() external onlyOwner() returns (bool) {
    // This has all the conditions and will revert if they are not met
    uint256 amountToMint = _finish();

    // src20 allowance pre-mint is required so that this contract can distribute tokens
    require(
      SRC20(token).allowance(msg.sender, address(this)) >= amountToMint,
      'Fundraiser: Not enough token allowance for distribution.'
    );
    ITokenMinter(minter).stakeAndMint(token, amountToMint);

    // send funds to the issuer
    _withdraw(msg.sender);
    return true;
  }

  /**
   *  Allow the caller, if he is eligible, to withdraw his tokens once
   *  they have been minted
   *
   *  @return true on success
   */
  function claimTokens() external returns (bool) {
    require(isFinished, 'Fundraise has not finished');
    require(qualifiedContributions[msg.sender] > 0, 'There are no tokens to claim');

    uint256 contributed = qualifiedContributions[msg.sender];
    qualifiedContributions[msg.sender] = 0;

    uint256 baseCurrencyDecimals = uint256(10)**ERC20Detailed(baseCurrency).decimals();
    uint256 tokenDecimals = uint256(10)**SRC20(token).decimals();

    // decimals: 6 + 18 - 18 + 18 - 6
    uint256 tokenAmount = contributed.mul(tokenDecimals).div(tokenPrice).mul(tokenDecimals).div(
      baseCurrencyDecimals
    );
    require(ISRC20(token).transferFrom(owner, msg.sender, tokenAmount), 'Token transfer failed');
    emit TokensClaimed(msg.sender, tokenAmount);
    return true;
  }

  function claimReferrals() external returns (bool) {
    require(isFinished, 'Fundraise is not finished');
    require(affiliateShares[msg.sender] > 0, 'There are no referrals to be collected');
    uint256 amount = affiliateShares[msg.sender];
    affiliateShares[msg.sender] = 0;
    require(IERC20(baseCurrency).transferFrom(owner, msg.sender, amount), 'Token transfer failed');

    emit ReferralClaimed(msg.sender, amount);
    return true;
  }

  function payFee(uint256 _amount) external {
    require(_amount != 0, 'Fundraiser: Fee must be greater than 0.');

    uint256 fee = FundraiserManager(fundraiserManager).fee();
    require(fee > totalFeePaid, 'Fundraiser: Fee already paid.');
    uint256 feeSum = totalFeePaid.add(_amount);
    uint256 required = _amount;

    if (feeSum > fee) {
      required = feeSum.sub(fee);
    }

    IERC20(baseCurrency).transferFrom(msg.sender, address(this), required);
    totalFeePaid = totalFeePaid.add(required);
    emit FeePaid(msg.sender, required);
  }

  function fee() external view returns (uint256) {
    return FundraiserManager(fundraiserManager).fee();
  }

  function isFeePaid() external view returns (bool) {
    return totalFeePaid == FundraiserManager(fundraiserManager).fee();
  }

  // forced by bytecode limitations
  function _ongoing() internal view returns (bool) {
    require(isSetup, 'Fundraise setup not completed');
    require(!isFinished, 'Fundraise has finished');
    require(!isHardcapReached, 'HardCap has been reached');
    require(block.timestamp >= startDate, 'Fundraise has not started yet');
    require(block.timestamp <= endDate, 'Fundraise has ended');
    return true;
  }

  /**
   *  Worker function for contributions
   *
   *  @param _contributor the address of the contributor
   *  @param _amount the amount of the contribution
   *  @param _referral referral, aka affiliate link
   *
   *  @return uint256 Actual contributed amount (subtracted when hardcap overflow etc.)
   */
  function _contribute(
    address _contributor,
    uint256 _amount,
    string memory _referral
  ) internal returns (uint256) {
    require(
      IContributorRestrictions(contributorRestrictions).checkMinInvestment(_amount),
      'Cannot invest less than minAmount'
    );

    bool qualified = IContributorRestrictions(contributorRestrictions).isWhitelisted(_contributor);
    uint256 maxAmount = IContributorRestrictions(contributorRestrictions).maxAmount();
    uint256 refund = 0;

    uint256 currentAmount = qualified
      ? qualifiedContributions[_contributor]
      : pendingContributions[_contributor];
    uint256 newAmount = currentAmount.add(_amount);
    if (!IContributorRestrictions(contributorRestrictions).checkMaxInvestment(newAmount)) {
      refund = newAmount.sub(maxAmount);
      _amount = _amount.sub(refund);
      require(_amount != 0, 'Cannot invest more than maxAmount');
    }

    if (qualified) {
      if (
        !IContributorRestrictions(contributorRestrictions).checkMaxContributors(
          numContributors.add(1)
        )
      ) {
        revert('Maximum number of contributors reached');
      }
      (bool hardcapReached, uint256 overHardcap) = _checkHardCap(amountQualified.add(_amount));
      if (hardcapReached) {
        isHardcapReached = hardcapReached;
        refund = refund.add(overHardcap);
        _amount = _amount.sub(overHardcap);
      }
    }

    // note: this never happens in reality, because every function that calls this has the ongoing modifier which checks for hardcap
    require(_amount > 0, 'Hardcap already reached');

    if (qualified) {
      qualifiedContributions[_contributor] = qualifiedContributions[_contributor].add(_amount);
      amountQualified = amountQualified.add(_amount);
      _addContributor(_contributor);
      if (affiliateManager != address(0)) {
        _addShare(_contributor, _referral, _amount);
      }
      emit ContributionAdded(_contributor, _amount);
    } else {
      pendingContributions[_contributor] = pendingContributions[_contributor].add(_amount);
      amountPending = amountPending.add(_amount);
      emit ContributionPending(_contributor, _amount);
    }

    if (refund > 0) {
      _refund(_contributor, refund);
    }

    return _amount;
  }

  function _addContributor(address _user) internal {
    if (!contributors[_user]) {
      numContributors = numContributors.add(1);
      contributors[_user] = true;
    }
  }

  function _removeContributor(address _user) internal {
    if (contributors[_user]) {
      numContributors = numContributors.sub(1);
      contributors[_user] = false;
    }
  }

  function _addShare(
    address _contributor,
    string memory _referral,
    uint256 _amount
  ) internal {
    if (bytes(_referral).length > 0) {
      (address affiliate, uint256 percentage) = AffiliateManager(affiliateManager).getByReferral(
        _referral
      );
      if (affiliate != address(0)) {
        if (
          contributorAffiliates[_contributor] == address(0) ||
          contributorAffiliates[_contributor] == affiliate
        ) {
          contributorAffiliates[_contributor] = affiliate;
          // percentage has 4 decimals, fraction has 6 decimals in total
          uint256 share = (_amount.mul(percentage)).div(1000000);
          contributorShares[_contributor] = contributorShares[_contributor].add(share);
          affiliateShares[affiliate] = affiliateShares[affiliate].add(share);
        }
      }
    }
  }

  function _removeShare(address _contributor) internal {
    if (contributorAffiliates[_contributor] != address(0)) {
      affiliateShares[contributorAffiliates[_contributor]] = affiliateShares[contributorAffiliates[_contributor]]
        .sub(contributorShares[_contributor]);
      contributorShares[_contributor] = 0;
      contributorAffiliates[_contributor] = address(0);
    }
  }

  function _checkHardCap(uint256 _amount) internal view returns (bool, uint256) {
    bool pass;
    uint256 refund;

    if (_amount >= hardCap) {
      pass = true;
      refund = _amount.sub(hardCap);
    } else {
      pass = false;
      refund = 0;
    }
    return (pass, refund);
  }

  function _forwardFunds(address _proxy, uint256 _amount) internal {
    IERC20(baseCurrency).transfer(_proxy, _amount);
  }

  function _retrieveFunds(address _proxy, uint256 _amount) internal {
    // proxy should hold the code to allow for funds to be retrieved
  }

  /**
   *  Perform all the necessary actions to finish the fundraise
   *
   *  @return true on success
   */
  function _finish() internal returns (uint256) {
    require(!isFinished, 'Already finished');
    require(amountQualified >= softCap, 'SoftCap not reached');
    require(
      totalFeePaid >= FundraiserManager(fundraiserManager).fee(),
      'Fundraiser: Fee must be fully paid.'
    );
    require(
      block.timestamp < endDate.add(FundraiserManager(fundraiserManager).expirationTime()),
      'Expiration time passed'
    );

    if (amountQualified < hardCap && block.timestamp < endDate) {
      revert('EndDate or hardCap not reached');
    }
    // lock the fundraise amount... it will be somewhere between the soft and hard caps
    contributionsLocked = true;
    isFinished = true;
    emit FundraiserFinished();

    // find out the token price
    uint256 baseCurrencyDecimals = uint256(10)**ERC20Detailed(baseCurrency).decimals();
    uint256 tokenDecimals = uint256(10)**SRC20(token).decimals();
    if (tokenPrice > 0) {
      // decimals: 6 + 18 - 6 = 18
      supply = ((amountQualified.mul(tokenDecimals)).div(tokenPrice));
    } else {
      // decimals: 6 + 18 - 18 + 18 - 6
      // decimals: 6 + 18 - 18 + 18 - 6
      tokenPrice = amountQualified.mul(tokenDecimals).div(supply).mul(tokenDecimals).div(
        baseCurrencyDecimals
      );
    }

    return supply;
  }

  /**
   *  Loop through the accepted currencies and initiate a withdrawal for
   *  each currency, sending the funds to the Token Issuer
   *
   *  @return true on success
   */
  function _withdraw(address _user) internal returns (bool) {
    amountWithdrawn = amountQualified;
    amountQualified = 0;

    require(IERC20(baseCurrency).transfer(_user, amountWithdrawn), 'ERC20 transfer failed');
    emit Withdrawn(_user, amountWithdrawn);

    return true;
  }

  function _fullRefund(address _user) internal returns (bool) {
    uint256 amount = qualifiedContributions[_user].add(pendingContributions[_user]);

    if (amount > 0) {
      amountQualified = amountQualified.sub(qualifiedContributions[_user]);
      amountPending = amountPending.sub(pendingContributions[_user]);
      delete qualifiedContributions[_user];
      delete pendingContributions[_user];
      _refund(_user, amount);
      return true;
    } else {
      return false;
    }
  }

  function _refund(address _contributor, uint256 _amount) internal returns (bool) {
    if (_amount > 0) {
      require(IERC20(baseCurrency).transfer(_contributor, _amount), 'ERC20 transfer failed!');

      emit ContributionRefunded(_contributor, _amount);
    }
    return true;
  }
}
