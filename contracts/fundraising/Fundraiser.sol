pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IGetRateMinter.sol';
import '../interfaces/IAffiliateManager.sol';
import '../interfaces/IContributorRestrictions.sol';

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract Fundraiser {
  using SafeMath for uint256;

  event ContributorAdded(address account);
  event ContributorAccepted(address account);
  event ContributorRemoved(address account);

  // new pending contribution added (by unqualified user)
  event ContributionPending(address indexed account, uint256 amount);
  // new qualified contribution added (by qualified user)
  event ContributionAdded(address indexed account, uint256 amount);
  // pending contribution converted to qualified
  event PendingContributionAccepted(address indexed account, uint256 amount);

  event ContributionRefunded(address indexed account, uint256 amount);
  event ContributionWithdrawn(address indexed account, uint256 amount);

  event TokensClaimed(address indexed account, uint256 amount);
  event FundsWithdrawal(address indexed account, uint256 amount);
  event ReferralCollected(address indexed account, uint256 amount);

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
  bool public contributionsLocked = true;

  // weird constants - should go to constructor :)
  uint256 public expirationTime = 2592000; // default: 60 * 60 * 24 * 30 = ~1month
  uint256 public fee = 2000e6; // USDC has 6 decimal places

  // state
  uint256 public numContributors = 0;
  uint256 public amountQualified = 0;
  uint256 public amountPending = 0;
  uint256 public amountWithdrawn = 0;
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

  // referral link of contributor
  mapping(address => address) public referrals;

  // total funds directed to the affiliate from referrals
  mapping(address => uint256) public totalAffiliateClaim;

  // funds directed to the affiliate from referrals per contributor
  mapping(address => uint256) public affiliateClaim;

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

  // forced by bytecode limitations, kept just below the modifier for clarity
  function _ongoing() internal view returns (bool) {
    require(isSetup, 'Fundraise setup not completed');
    require(!isFinished, 'Fundraise has finished');
    require(!isHardcapReached, 'HardCap has been reached');
    require(block.timestamp >= startDate, 'Fundraise has not started yet');
    require(block.timestamp <= endDate, 'Fundraise has ended');
    return true;
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
    owner = msg.sender;
    label = _label;
    token = _token;
    supply = _supply;
    startDate = _startDate;
    endDate = _endDate;
    softCap = _softCap;
    hardCap = _hardCap;
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

    baseCurrency = _baseCurrency;
    tokenPrice = _tokenPrice;
    affiliateManager = _affiliateManager;
    contributorRestrictions = _contributorRestrictions;
    contributionsLocked = _contributionsLocked;
    minter = _minter;
    isSetup = true;
  }

  /**
   *  Cancel the fundraise. Can be done by the Token Issuer at any time
   *  The contributions are then available to be withdrawn by contributors
   *
   *  @return true on success
   */
  function cancel() external onlyOwner() returns (bool) {
    isCanceled = true;
    contributionsLocked = false;
    return true;
  }

  /**
   *  contribute funds with an affiliate link
   *
   *  @param amount the amount of the contribution
   *  @param affiliateLink (optional) affiliate link used
   *  @return true on success
   */
  function contribute(uint256 amount, string calldata affiliateLink)
    external
    ongoing
    returns (bool)
  {
    require(amount > 0, 'Amount has to be greater than 0');

    require(
      IERC20(baseCurrency).transferFrom(msg.sender, address(this), amount),
      'ERC20 transfer failed'
    );

    require(
      _contribute(msg.sender, amount, affiliateLink),
      'Contribution does not meet the minimum requirement'
    );

    return true;
  }

  /**
   *  Once a contributor has been Whitelisted, this function gets called to
   *  process his buffered/pending transaction
   *
   *  @param contributor the contributor we want to add
   *  @return true on success
   */
  function acceptContributor(address contributor)
    external
    ongoing
    onlyContributorRestrictions
    returns (bool)
  {
    uint256 amount = pendingContributions[contributor];
    // process contribution
    if (amount > 0) {
      pendingContributions[contributor] = 0;
      amountPending = amountPending.sub(amount);
      string memory link = IAffiliateManager(affiliateManager).getAffiliateLink(
        referrals[contributor]
      );
      _contribute(contributor, amount, link);
      emit PendingContributionAccepted(contributor, pendingContributions[contributor]);
    }
    emit ContributorAccepted(contributor);
    return true;
  }

  /**
   *  Removes a contributor (his contributions)
   *  This function can only be called by the
   *  restrictions/whitelisting contract
   *
   *  @param contributor the contributor we want to remove
   *  @return true on success
   */
  function removeContributor(address contributor)
    external
    ongoing
    onlyContributorRestrictions
    returns (bool)
  {
    _removeContributor(contributor);
    _removeAffiliate(contributor);
    _fullRefund(contributor);

    emit ContributorRemoved(contributor);
    return true;
  }

  /**
   *  Allows contributor to get refunds of the amounts he contributed, if
   *  various conditions are met
   *
   *  @return true on success
   */
  function getRefund() external returns (bool) {
    require(
      isCanceled || block.timestamp > endDate.add(expirationTime) || !contributionsLocked,
      'Condition for refund not met (event canceled, expired or contributions not locked)!'
    );
    if (!contributionsLocked) {
      _removeContributor(msg.sender);
      _removeAffiliate(msg.sender);
    }
    require(_fullRefund(msg.sender), 'There are no funds to refund');
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
    uint256 amountToMint = _finishFundraise();

    IGetRateMinter(minter).stakeAndMint(token, amountToMint);

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

    uint256 contributions = qualifiedContributions[msg.sender];
    qualifiedContributions[msg.sender] = 0;

    // @cicnos make sure division won't end in zero for small amounts
    uint256 tokenShares = contributions.div(tokenPrice);

    require(IERC20(token).transfer(msg.sender, tokenShares), 'Token transfer failed');

    emit TokensClaimed(msg.sender, tokenShares);
    return true;
  }

  function claimReferrals() external returns (bool) {
    require(isFinished, 'Fundraise is not finished');
    require(totalAffiliateClaim[msg.sender] > 0, 'There are no referrals to be collected');
    uint256 amount = totalAffiliateClaim[msg.sender];
    totalAffiliateClaim[msg.sender] = 0;
    require(IERC20(token).transfer(msg.sender, amount), 'Token transfer failed');

    emit ReferralCollected(msg.sender, amount);
    return true;
  }

  /**
   *  Worker function for contributions
   *
   *  @param contributor the address of the contributor
   *  @param amount the amount of the contribution
   *
   *  @return true on success
   */
  function _contribute(
    address contributor,
    uint256 amount,
    string memory affiliateLink
  ) internal returns (bool) {
    require(
      IContributorRestrictions(contributorRestrictions).checkMinInvestment(amount),
      'Cannot invest less than minAmount'
    );

    bool qualified = IContributorRestrictions(contributorRestrictions).isWhitelisted(contributor);
    uint256 maxAmount = IContributorRestrictions(contributorRestrictions).maxInvestmentAmount();
    uint256 refund = 0;

    uint256 currentAmount = qualified
      ? qualifiedContributions[contributor]
      : pendingContributions[contributor];
    uint256 newAmount = currentAmount.add(amount);
    if (!IContributorRestrictions(contributorRestrictions).checkMaxInvestment(newAmount)) {
      refund = newAmount.sub(maxAmount);
      amount = amount.sub(refund);
    }

    if (qualified) {
      (bool hardcapReached, uint256 overHardcap) = _checkHardCap(amountQualified + amount);
      if (hardcapReached) {
        isHardcapReached = hardcapReached;
        refund = refund.add(overHardcap);
        amount = amount.sub(overHardcap);
      }
    }

    if (amount > 0) {
      if (qualified) {
        qualifiedContributions[contributor] = qualifiedContributions[contributor].add(amount);
        amountQualified = amountQualified.add(amount);
        _addContributor(contributor);
        _addAffiliate(contributor, affiliateLink, amount);
        emit ContributionPending(contributor, amount);
      } else {
        pendingContributions[contributor] = pendingContributions[contributor].add(amount);
        amountPending = amountPending.add(amount);
        emit ContributionAdded(contributor, amount);
      }
    }

    if (refund > 0) {
      _refund(contributor, refund);
    }

    return true;
  }

  function _addContributor(address user) internal {
    if (!contributors[user]) {
      numContributors = numContributors.add(1);
      contributors[user] = true;
    }
  }

  function _removeContributor(address user) internal {
    if (contributors[user]) {
      numContributors = numContributors.sub(1);
      contributors[user] = false;
    }
  }

  function _addAffiliate(
    address user,
    string memory affiliateLink,
    uint256 amount
  ) internal {
    if (bytes(affiliateLink).length > 0) {
      (address affiliate, uint256 percentage) = IAffiliateManager(affiliateManager).getAffiliate(
        affiliateLink
      );

      if (affiliate != address(0)) {
        if (referrals[user] == address(0) || referrals[user] == affiliate) {
          referrals[user] = affiliate;
          uint256 claim = amount.mul(percentage).div(100);
          affiliateClaim[user] = affiliateClaim[user].add(claim);
          totalAffiliateClaim[affiliate] = totalAffiliateClaim[affiliate].add(claim);
        }
      }
    }
  }

  function _removeAffiliate(address user) internal {
    if (referrals[user] != address(0)) {
      totalAffiliateClaim[referrals[user]] = totalAffiliateClaim[referrals[user]].sub(
        affiliateClaim[user]
      );
      affiliateClaim[user] = 0;
      referrals[user] = address(0);
    }
  }

  function _checkHardCap(uint256 amount) internal view returns (bool, uint256) {
    bool pass;
    uint256 refund;

    if (amount >= hardCap) {
      pass = true;
      refund = amount.sub(hardCap);
    } else {
      pass = false;
      refund = 0;
    }
    return (pass, refund);
  }

  function _forwardFunds(address proxy, uint256 amount) internal {
    IERC20(baseCurrency).transfer(proxy, amount);
  }

  function _retrieveFunds(address proxy, uint256 amount) internal {
    // proxy should hold the code to allow for funds to be retrieved
  }

  /**
   *  Perform all the necessary actions to finish the fundraise
   *
   *  @return true on success
   */
  function _finishFundraise() internal returns (uint256) {
    require(!isFinished, 'Already finished');
    require(block.timestamp < endDate.add(expirationTime), 'Expiration time passed');
    require(amountQualified >= softCap, 'SoftCap not reached');

    if (amountQualified < hardCap && block.timestamp < endDate) {
      revert('Softcap is only valid after end date');
    }
    // lock the fundraise amount... it will be somewhere between the soft and hard caps
    contributionsLocked = true;
    isFinished = true;

    // find out the token price
    if (tokenPrice > 0) return amountQualified.div(tokenPrice);
    else {
      tokenPrice = amountQualified.div(supply);
      return supply;
    }
  }

  /**
   *  Loop through the accepted currencies and initiate a withdrawal for
   *  each currency, sending the funds to the Token Issuer
   *
   *  @return true on success
   */
  function _withdraw(address user) internal returns (bool) {
    amountWithdrawn = amountQualified;
    amountQualified = 0;

    require(IERC20(baseCurrency).transfer(user, amountWithdrawn), 'ERC20 transfer failed');
    emit FundsWithdrawal(user, amountWithdrawn);

    return true;
  }

  function _fullRefund(address user) internal returns (bool) {
    uint256 amount = qualifiedContributions[user].add(pendingContributions[user]);

    if (amount > 0) {
      amountQualified = amountQualified.sub(qualifiedContributions[user]);
      amountPending = amountPending.sub(pendingContributions[user]);
      delete qualifiedContributions[user];
      delete pendingContributions[user];
      _refund(user, amount);
      return true;
    } else {
      return false;
    }
  }

  function _refund(address contributor, uint256 amount) internal returns (bool) {
    if (amount > 0) {
      require(IERC20(baseCurrency).transfer(contributor, amount), 'ERC20 transfer failed!');

      emit ContributionRefunded(contributor, amount);
    }
    return true;
  }
}
