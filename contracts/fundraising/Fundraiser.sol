// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

import '../interfaces/ITokenMinter.sol';
import '../token/SRC20.sol';
import '../factories/SRC20Registry.sol';
import './ContributorRestrictions.sol';
import './FundraiserManager.sol';
import './AffiliateManager.sol';

import '@nomiclabs/buidler/console.sol';

/**
 * @title Fundraise Contract
 * This contract allows a SRC20 token owner to perform a Swarm-Powered Fundraise.
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

  // contributors who have been whitelisted and contributed funds
  mapping(address => bool) public contributors;

  // contributor to affiliate address mapping
  mapping(address => address) public contributorAffiliates;

  // affil share per affiliate. how much an affiliate gets
  mapping(address => uint256) public affiliateShares;

  // affil share per contributor. we need this to be able to revert given contributors part of affiliate share
  mapping(address => uint256) public contributorShares;

  modifier onlyOwner() {
    require(msg.sender == owner, 'Fundraiser: Caller is not the owner!');
    _;
  }

  modifier onlyContributorRestrictions {
    require(
      msg.sender == contributorRestrictions,
      'Fundraiser: Caller not Contributor Restrictions contract!'
    );
    _;
  }

  modifier onlyAcceptedCurrencies(address currency) {
    require(currency == baseCurrency, 'Fundraiser: Unsupported contribution currency');
    _;
  }

  modifier ongoing {
    _ongoing();
    _;
  }

  /**
   *  Pass all the most important parameters that define the Fundraise
   *  All variables cannot be in the constructor because we get "stack too deep" error
   *  After deployment, the setup() function needs to be called to set them up
   */
  constructor(
    string memory _label,
    address _token,
    uint256 _supply,
    uint256 _startDate,
    uint256 _endDate,
    uint256 _softCap,
    uint256 _hardCap
  ) {
    require(_hardCap >= _softCap, 'Fundraiser: Hardcap has to be >= Softcap');

    startDate = _startDate == 0 || _startDate < block.timestamp ? block.timestamp : _startDate;
    require(_endDate > _startDate, 'Fundraiser: End date has to be after start date');

    owner = msg.sender;
    label = _label;
    token = _token;
    supply = _supply;
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
    require(
      _tokenPrice != 0 || supply != 0,
      'Fundraiser: Either price or amount to mint is needed'
    );
    require(!isSetup, 'Fundraiser: Contract is already set up');
    require(!isCanceled, 'Fundraiser: Fundraiser is canceled');

    SRC20Registry(SRC20(token).registry()).registerFundraise(token, address(this));

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
   *  Contributions are then available to be withdrawn by contributors
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
      'Fundraiser: ERC20 transfer failed'
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
      emit PendingContributionAccepted(_contributor, realAmount);
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
      'Fundraiser: Condition for refund not met (event canceled, expired or contributions not locked)!'
    );
    require(_fullRefund(msg.sender), 'Fundraiser: There are no funds to refund');
    _removeContributor(msg.sender);
    _removeShare(msg.sender);
    emit ContributorRemoved(msg.sender, false);
    return true;
  }

  /**
   *  Conclude fundraise and mint SRC20 tokens
   *
   *  @return true on success
   */
  function concludeAndmint() external onlyOwner() returns (bool) {
    // This has all the conditions and will revert if they are not met
    uint256 amountToMint = _finish();

    // src20 allowance pre-mint is required so that this contract can distribute tokens
    require(
      SRC20(token).allowance(msg.sender, address(this)) >= amountToMint,
      'Fundraiser: Not enough token allowance for distribution.'
    );
    ITokenMinter(minter).mint(token, address(this), amountToMint);

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
    require(isFinished, 'Fundraiser: Fundraise has not finished');
    require(qualifiedContributions[msg.sender] != 0, 'Fundraiser: There are no tokens to claim');

    uint256 contributed = qualifiedContributions[msg.sender];
    qualifiedContributions[msg.sender] = 0;

    uint256 baseCurrencyDecimals = uint256(10)**ERC20(baseCurrency).decimals();
    uint256 tokenDecimals = uint256(10)**SRC20(token).decimals();

    // decimals: 6 + 18 - 18 + 18 - 6
    uint256 tokenAmount = contributed.mul(tokenDecimals).div(tokenPrice).mul(tokenDecimals).div(
      baseCurrencyDecimals
    );
    require(
      SRC20(token).transferFrom(owner, msg.sender, tokenAmount),
      'Fundraiser: Token transfer failed'
    );
    emit TokensClaimed(msg.sender, tokenAmount);
    return true;
  }

  function claimReferrals() external returns (bool) {
    require(isFinished, 'Fundraiser: Fundraise is not finished');
    require(affiliateShares[msg.sender] != 0, 'Fundraiser: There are no referrals to be collected');
    uint256 amount = affiliateShares[msg.sender];
    affiliateShares[msg.sender] = 0;
    require(
      IERC20(baseCurrency).transferFrom(owner, msg.sender, amount),
      'Fundraiser: Token transfer failed'
    );

    emit ReferralClaimed(msg.sender, amount);
    return true;
  }

  function payFee(uint256 _amount) external {
    require(_amount != 0, 'Fundraiser: Fee amount to pay must be greater than 0');

    uint256 _fee = FundraiserManager(fundraiserManager).fee();
    require(_fee != 0, 'Fundraiser: There is no fee at the moment');
    require(_fee > totalFeePaid, 'Fundraiser: Fee already paid');

    uint256 feeSum = totalFeePaid.add(_amount);
    uint256 required = _amount;

    if (feeSum > _fee) {
      required = feeSum.sub(_fee);
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
    require(isSetup, 'Fundraiser: Fundraise setup not completed');
    require(!isFinished, 'Fundraiser: Fundraise has finished');
    require(!isHardcapReached, 'Fundraiser: HardCap has been reached');
    require(block.timestamp >= startDate, 'Fundraiser: Fundraise has not started yet');
    require(block.timestamp <= endDate, 'Fundraiser: Fundraise has ended');
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
      ContributorRestrictions(contributorRestrictions).checkMinInvestment(_amount),
      'Fundraiser: Cannot invest less than minAmount'
    );

    bool qualified = ContributorRestrictions(contributorRestrictions).isWhitelisted(_contributor);
    uint256 maxAmount = ContributorRestrictions(contributorRestrictions).maxAmount();
    uint256 refund = 0;

    uint256 currentAmount = qualified
      ? qualifiedContributions[_contributor]
      : pendingContributions[_contributor];

    uint256 newAmount = currentAmount.add(_amount);

    if (!ContributorRestrictions(contributorRestrictions).checkMaxInvestment(newAmount)) {
      refund = newAmount.sub(maxAmount);
      _amount = _amount.sub(refund);
      require(_amount != 0, 'Fundraiser: Cannot invest more than maxAmount');
    }

    if (qualified) {
      if (
        !ContributorRestrictions(contributorRestrictions).checkMaxContributors(
          numContributors.add(1)
        )
      ) {
        revert('Fundraiser: Maximum number of contributors reached');
      }
      (bool hardcapReached, uint256 overHardcap) = _checkHardCap(amountQualified.add(_amount));
      if (hardcapReached) {
        isHardcapReached = hardcapReached;
        refund = refund.add(overHardcap);
        _amount = _amount.sub(overHardcap);
      }
    }

    require(_amount != 0, 'Fundraiser: Hardcap already reached');

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
      // @Jiri: Shouldn't the _amount being emitted in this event be the total amount pending for this contributor?
      emit ContributionPending(_contributor, _amount);
    }

    if (refund != 0) {
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
    if (bytes(_referral).length != 0) {
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
    bool hardcapReached;
    uint256 overflow;

    if (_amount >= hardCap) {
      hardcapReached = true;
      overflow = _amount.sub(hardCap);
    } else {
      hardcapReached = false;
      overflow = 0;
    }
    return (hardcapReached, overflow);
  }

  /**
   *  Perform all the necessary actions to finish the fundraise
   *
   *  @return true on success
   */
  function _finish() internal returns (uint256) {
    require(!isFinished, 'Fundraiser: Already finished');
    require(amountQualified >= softCap, 'Fundraiser: SoftCap not reached');
    require(
      totalFeePaid >= FundraiserManager(fundraiserManager).fee(),
      'Fundraiser: Fee must be fully paid.'
    );
    require(
      block.timestamp < endDate.add(FundraiserManager(fundraiserManager).expirationTime()),
      'Fundraiser: Expiration time passed'
    );

    if (amountQualified < hardCap && block.timestamp < endDate) {
      revert('Fundraiser: EndDate or hardCap not reached');
    }
    // lock the fundraise amount... it will be somewhere between the soft and hard caps
    contributionsLocked = true;
    isFinished = true;
    emit FundraiserFinished();

    // find out the token price
    uint256 baseCurrencyDecimals = uint256(10)**ERC20(baseCurrency).decimals();
    uint256 tokenDecimals = uint256(10)**SRC20(token).decimals();
    if (tokenPrice != 0) {
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

  function _withdraw(address _user) internal returns (bool) {
    amountWithdrawn = amountQualified;
    amountQualified = 0;

    require(
      IERC20(baseCurrency).transfer(_user, amountWithdrawn),
      'Fundraiser: ERC20 transfer failed'
    );
    emit Withdrawn(_user, amountWithdrawn);

    return true;
  }

  function _fullRefund(address _user) internal returns (bool) {
    uint256 amount = qualifiedContributions[_user].add(pendingContributions[_user]);

    if (amount != 0) {
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
    require(
      IERC20(baseCurrency).transfer(_contributor, _amount),
      'Fundraiser: ERC20 transfer failed!'
    );

    emit ContributionRefunded(_contributor, _amount);
    return true;
  }
}
