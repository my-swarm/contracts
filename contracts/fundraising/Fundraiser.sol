// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import '../interfaces/ITokenMinter.sol';
import '../token/SRC20.sol';
import '../factories/SRC20Registry.sol';
import './ContributorRestrictions.sol';
import './FundraiserManager.sol';
import './AffiliateManager.sol';

/**
 * @title Fundraise Contract
 * This contract allows a SRC20 token owner to perform a Swarm-Powered Fundraise.
 */
contract Fundraiser is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for ERC20;

  event FundraiserCreated(
    string label,
    address token,
    uint256 supply,
    uint256 tokenPrice,
    uint256 startDate,
    uint256 endDate,
    uint256 softCap,
    uint256 hardCap
  );

  event FundraiserSetup(
    address baseCurrency,
    address affiliateManager,
    address contributorRestrictions,
    address fundraiserManager,
    address minter
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
  uint256 public numContributors;
  uint256 public amountQualified;
  uint256 public amountPending;
  uint256 public amountWithdrawn;
  uint256 public totalFeePaid;
  uint256 public totalEarnedByAffiliates;

  bool public isFinished;
  bool public isCanceled;
  bool public isSetup;
  bool public isHardcapReached;

  // per contributor, these are contributors that have not been whitelisted yet
  mapping(address => uint256) public pendingContributions;

  // per whitelisted contributor, qualified amount
  // a qualified amount is an amount that has passed min/max checks
  mapping(address => uint256) public qualifiedContributions;

  // contributors who have been whitelisted and contributed funds
  mapping(address => bool) public contributors;

  // contributor to affiliate address mapping
  mapping(address => address) public contributorAffiliate;

  // affil share per affiliate. how much an affiliate gets
  mapping(address => uint256) public affiliateEarned;

  // affil pending payment to affiliate per contributor. we need this to be able to revert given contributors part of affiliate share
  mapping(address => uint256) public pendingAffiliatePayment;

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
    uint256 _tokenPrice,
    uint256 _startDate,
    uint256 _endDate,
    uint256 _softCap,
    uint256 _hardCap,
    uint256 _maxContributors,
    uint256 _minInvestmentAmount,
    uint256 _maxInvestmentAmount,
    bool _contributionsLocked,
    address[] memory addressList
  ) {
    require(msg.sender == SRC20(_token).owner(), 'Only token owner can initiate fundraise');
    require(
      _supply != 0 || _tokenPrice != 0,
      'Fundraiser: Either price or amount to mint is needed'
    );
    require(_hardCap >= _softCap, 'Fundraiser: Hardcap has to be >= Softcap');

    startDate = _startDate == 0 || _startDate < block.timestamp ? block.timestamp : _startDate;
    require(_endDate > startDate, 'Fundraiser: End date has to be after start date');

    label = _label;
    token = _token;
    supply = _supply;

    if (supply == 0) {
      tokenPrice = _tokenPrice;
    }

    endDate = _endDate;
    softCap = _softCap;
    hardCap = _hardCap;
    contributionsLocked = _contributionsLocked;

    affiliateManager = address(new AffiliateManager(address(this)));
    contributorRestrictions = address(
      new ContributorRestrictions(
        address(this),
        _maxContributors,
        _minInvestmentAmount,
        _maxInvestmentAmount
      )
    );

    baseCurrency = addressList[0];
    fundraiserManager = addressList[1];
    minter = addressList[2];
    isSetup = true;

    SRC20Registry(SRC20(token).registry()).registerFundraise(msg.sender, token);

    emit FundraiserCreated(label, token, supply, tokenPrice, startDate, endDate, softCap, hardCap);
    emit FundraiserSetup(
      baseCurrency,
      affiliateManager,
      contributorRestrictions,
      fundraiserManager,
      minter
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
      ContributorRestrictions(contributorRestrictions).checkMinInvestment(_amount),
      'Fundraiser: Cannot invest less than minAmount'
    );

    ERC20(baseCurrency).safeTransferFrom(msg.sender, address(this), _amount);

    _processContribution(msg.sender, _amount, _referral);

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
    uint256 pendingAmount = pendingContributions[_contributor];

    // process pending contribution
    if (pendingAmount != 0) {
      pendingContributions[_contributor] = 0;
      amountPending = amountPending.sub(pendingAmount);

      string memory referral =
        AffiliateManager(affiliateManager).getReferral(contributorAffiliate[_contributor]);

      uint256 totalAmount = _processContribution(_contributor, pendingAmount, referral);
      emit PendingContributionAccepted(_contributor, totalAmount);
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
    _removeAffiliatePayment(_contributor);
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
    bool isExpired =
      block.timestamp > endDate.add(FundraiserManager(fundraiserManager).expirationTime());
    require(
      isCanceled || isExpired || !contributionsLocked,
      'Fundraiser: Condition for refund not met (event canceled, expired or contributions not locked)!'
    );
    require(_fullRefund(msg.sender), 'Fundraiser: There are no funds to refund');

    _removeContributor(msg.sender);
    _removeAffiliatePayment(msg.sender);

    emit ContributorRemoved(msg.sender, false);
    return true;
  }

  /**
   *  Conclude fundraise and mint SRC20 tokens
   *
   *  @return true on success
   */
  function concludeFundraise(bool mintTokens) external onlyOwner() returns (bool) {
    require(_concludeFundraise(), 'Fundraiser: Not possible to conclude fundraise');

    uint256 amountToAllocate = _calculateSupply();

    require(amountToAllocate != 0, 'Fundraiser: No tokens to allocate');

    if (mintTokens == false) {
      require(
        ERC20(token).balanceOf(msg.sender) >= amountToAllocate,
        'Fundraiser: Not enough tokens were minted'
      );
      ITokenMinter(minter).burn(token, msg.sender, amountToAllocate);
    }
    ITokenMinter(minter).mint(token, address(this), amountToAllocate);

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
    uint256 tokenAmount =
      contributed.mul(tokenDecimals).div(tokenPrice).mul(tokenDecimals).div(baseCurrencyDecimals);

    ERC20(token).safeTransfer(msg.sender, tokenAmount);

    emit TokensClaimed(msg.sender, tokenAmount);
    return true;
  }

  function claimReferrals() external returns (bool) {
    require(isFinished, 'Fundraiser: Fundraise is not finished');
    require(affiliateEarned[msg.sender] != 0, 'Fundraiser: There are no referrals to be collected');

    uint256 amount = affiliateEarned[msg.sender];
    affiliateEarned[msg.sender] = 0;

    ERC20(baseCurrency).safeTransfer(msg.sender, amount);

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

    ERC20(baseCurrency).safeTransferFrom(msg.sender, address(this), required);
    totalFeePaid = totalFeePaid.add(required);
    emit FeePaid(msg.sender, required);
  }

  function fee() external view returns (uint256) {
    return FundraiserManager(fundraiserManager).fee();
  }

  function isFeePaid() external view returns (bool) {
    return totalFeePaid == FundraiserManager(fundraiserManager).fee();
  }

  function withdrawStuckTokens(address _token, uint256 _amount) public onlyOwner {
    require(
      _token != address(baseCurrency) || _token != address(token),
      'Fundraiser: Cannot withdraw token'
    );

    ERC20(_token).safeTransfer(msg.sender, _amount);
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
  function _processContribution(
    address _contributor,
    uint256 _amount,
    string memory _referral
  ) internal returns (uint256) {
    uint256 refund;
    uint256 acceptedAmount;
    bool qualified = ContributorRestrictions(contributorRestrictions).isWhitelisted(_contributor);

    (refund, acceptedAmount) = _processMaxInvesment(qualified, _contributor, _amount);

    if (qualified) {
      require(
        ContributorRestrictions(contributorRestrictions).checkMaxContributors(
          numContributors.add(1)
        ),
        'Fundraiser: Maximum number of contributors reached'
      );

      uint256 overHardCap;

      (overHardCap, acceptedAmount) = _processHardCap(acceptedAmount);
      refund = refund.add(overHardCap);

      _addQualifiedInvestment(_contributor, acceptedAmount, _referral);
    } else {
      _addPendingInvestment(_contributor, acceptedAmount);
    }

    if (refund != 0) {
      _refund(_contributor, refund);
    }

    return acceptedAmount;
  }

  function _addQualifiedInvestment(
    address _contributor,
    uint256 _amount,
    string memory _referral
  ) internal {
    qualifiedContributions[_contributor] = qualifiedContributions[_contributor].add(_amount);
    amountQualified = amountQualified.add(_amount);

    _addContributor(_contributor);
    _processAffiliatePayment(_contributor, _referral, _amount);

    emit ContributionAdded(_contributor, _amount);
  }

  function _addPendingInvestment(address _contributor, uint256 _amount) internal {
    pendingContributions[_contributor] = pendingContributions[_contributor].add(_amount);
    amountPending = amountPending.add(_amount);
    // @Jiri: Shouldn't the _amount being emitted in this event be the total amount pending for this contributor?
    emit ContributionPending(_contributor, _amount);
  }

  function _processHardCap(uint256 _amount)
    internal
    returns (uint256 _overHardCap, uint256 _underHardcap)
  {
    bool hardcapReached;

    (hardcapReached, _overHardCap) = _validateHardCap(amountQualified.add(_amount));
    _underHardcap = _amount.sub(_overHardCap);

    if (hardcapReached) {
      isHardcapReached = hardcapReached;
      require(_underHardcap != 0, 'Fundraiser: Hardcap already reached');
    }
  }

  function _processMaxInvesment(
    bool _qualified,
    address _contributor,
    uint256 _amount
  ) internal view returns (uint256 _overMax, uint256 _acceptedAmount) {
    _overMax = 0;
    _acceptedAmount = _amount;
    uint256 maxAmount = ContributorRestrictions(contributorRestrictions).maxAmount();

    uint256 currentAmount =
      _qualified ? qualifiedContributions[_contributor] : pendingContributions[_contributor];

    uint256 totalAmount = currentAmount.add(_amount);

    if (!ContributorRestrictions(contributorRestrictions).checkMaxInvestment(totalAmount)) {
      _overMax = totalAmount.sub(maxAmount);
      _acceptedAmount = _amount.sub(_overMax);
      require(_acceptedAmount != 0, 'Fundraiser: Cannot invest more than maxAmount');
    }
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

  function _processAffiliatePayment(
    address _contributor,
    string memory _referral,
    uint256 _amount
  ) internal {
    if (bytes(_referral).length != 0) {
      (address affiliate, uint256 percentage) =
        AffiliateManager(affiliateManager).getByReferral(_referral);
      if (affiliate != address(0)) {
        if (
          contributorAffiliate[_contributor] == address(0) ||
          contributorAffiliate[_contributor] == affiliate
        ) {
          contributorAffiliate[_contributor] = affiliate;
          // percentage has 4 decimals, fraction has 6 decimals in total
          uint256 payment = (_amount.mul(percentage)).div(1000000);
          pendingAffiliatePayment[_contributor] = pendingAffiliatePayment[_contributor].add(
            payment
          );
          affiliateEarned[affiliate] = affiliateEarned[affiliate].add(payment);
          totalEarnedByAffiliates = totalEarnedByAffiliates.add(payment);
        }
      }
    }
  }

  function _removeAffiliatePayment(address _contributor) internal {
    if (contributorAffiliate[_contributor] != address(0)) {
      affiliateEarned[contributorAffiliate[_contributor]] = affiliateEarned[
        contributorAffiliate[_contributor]
      ]
        .sub(pendingAffiliatePayment[_contributor]);

      totalEarnedByAffiliates = totalEarnedByAffiliates.sub(pendingAffiliatePayment[_contributor]);

      pendingAffiliatePayment[_contributor] = 0;
      contributorAffiliate[_contributor] = address(0);
    }
  }

  function _validateHardCap(uint256 _amount) internal view returns (bool, uint256) {
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

  function _concludeFundraise() internal returns (bool) {
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

    return true;
  }

  /**
   *  Perform all the necessary actions to finish the fundraise
   *
   *  @return true on success
   */
  function _calculateSupply() internal returns (uint256) {
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
    amountWithdrawn = amountQualified.sub(totalEarnedByAffiliates);
    amountQualified = 0;

    ERC20(baseCurrency).safeTransfer(_user, amountWithdrawn);
    emit Withdrawn(_user, amountWithdrawn);

    return true;
  }

  function _fullRefund(address _user) internal returns (bool) {
    uint256 refundAmount = qualifiedContributions[_user].add(pendingContributions[_user]);

    if (refundAmount != 0) {
      amountQualified = amountQualified.sub(qualifiedContributions[_user]);
      amountPending = amountPending.sub(pendingContributions[_user]);
      delete qualifiedContributions[_user];
      delete pendingContributions[_user];

      _refund(_user, refundAmount);

      return true;
    } else {
      return false;
    }
  }

  function _refund(address _contributor, uint256 _amount) internal returns (bool) {
    ERC20(baseCurrency).safeTransfer(_contributor, _amount);

    emit ContributionRefunded(_contributor, _amount);
    return true;
  }
}
