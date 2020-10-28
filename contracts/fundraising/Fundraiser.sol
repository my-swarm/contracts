pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IGetRateMinter.sol';
import '../interfaces/IAffiliateManager.sol';
import '../interfaces/IContributorRestrictions.sol';
import '../interfaces/ISRC20.sol';
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
    tokenPrice = _tokenPrice;
    affiliateManager = _affiliateManager;
    contributorRestrictions = _contributorRestrictions;
    contributionsLocked = _contributionsLocked;
    minter = _minter;
    isSetup = true;

    emit FundraiserSetup(
      baseCurrency,
      tokenPrice,
      affiliateManager,
      contributorRestrictions,
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
    // todo: allow cancel if finished ??
    isCanceled = true;
    contributionsLocked = false;
    emit FundraiserCanceled();
    return true;
  }

  /**
   *  contribute funds with an affiliate link
   *
   *  @param _amount the amount of the contribution
   *  @param _affiliateLink (optional) affiliate link used
   *  @return true on success
   */
  function contribute(uint256 _amount, string calldata _affiliateLink)
    external
    ongoing
    returns (bool)
  {
    require(_amount > 0, 'Amount has to be greater than 0');

    require(
      IERC20(baseCurrency).transferFrom(msg.sender, address(this), _amount),
      'ERC20 transfer failed'
    );

    _contribute(msg.sender, _amount, _affiliateLink);
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
      string memory link = IAffiliateManager(affiliateManager).getAffiliateLink(
        referrals[_contributor]
      );
      uint256 realAmount = _contribute(_contributor, amount, link);
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
    _removeAffiliate(_contributor);
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
    bool isExpired = block.timestamp > endDate.add(expirationTime);
    require(
      isCanceled || isExpired || !contributionsLocked,
      'Condition for refund not met (event canceled, expired or contributions not locked)!'
    );
    require(_fullRefund(msg.sender), 'There are no funds to refund');
    _removeContributor(msg.sender);
    _removeAffiliate(msg.sender);
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
   *  @param _contributor the address of the contributor
   *  @param _amount the amount of the contribution
   *
   *  @return uint256 Actual contributed amount (subtracted when hardcap overflow etc.)
   */
  function _contribute(
    address _contributor,
    uint256 _amount,
    string memory _affiliateLink
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
    }

    if (qualified) {
      (bool hardcapReached, uint256 overHardcap) = _checkHardCap(amountQualified + _amount);
      if (hardcapReached) {
        isHardcapReached = hardcapReached;
        refund = refund.add(overHardcap);
        _amount = _amount.sub(overHardcap);
      }
    }

    require(_amount > 0, 'Hardcap already reached');

    if (qualified) {
      qualifiedContributions[_contributor] = qualifiedContributions[_contributor].add(_amount);
      amountQualified = amountQualified.add(_amount);
      _addContributor(_contributor);
      _addAffiliate(_contributor, _affiliateLink, _amount);
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

  function _addAffiliate(
    address _user,
    string memory _affiliateLink,
    uint256 _amount
  ) internal {
    if (bytes(_affiliateLink).length > 0) {
      (address affiliate, uint256 percentage) = IAffiliateManager(affiliateManager).getAffiliate(
        _affiliateLink
      );

      if (affiliate != address(0)) {
        if (referrals[_user] == address(0) || referrals[_user] == affiliate) {
          referrals[_user] = affiliate;
          uint256 claim = _amount.mul(percentage).div(100);
          affiliateClaim[_user] = affiliateClaim[_user].add(claim);
          totalAffiliateClaim[affiliate] = totalAffiliateClaim[affiliate].add(claim);
        }
      }
    }
  }

  function _removeAffiliate(address _user) internal {
    if (referrals[_user] != address(0)) {
      totalAffiliateClaim[referrals[_user]] = totalAffiliateClaim[referrals[_user]].sub(
        affiliateClaim[_user]
      );
      affiliateClaim[_user] = 0;
      referrals[_user] = address(0);
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
    require(block.timestamp < endDate.add(expirationTime), 'Expiration time passed');
    require(amountQualified >= softCap, 'SoftCap not reached');

    if (amountQualified < hardCap && block.timestamp < endDate) {
      revert('Softcap is only valid after end date');
    }
    // lock the fundraise amount... it will be somewhere between the soft and hard caps
    contributionsLocked = true;
    isFinished = true;
    emit FundraiserFinished();

    // find out the token price
    if (tokenPrice > 0) {
      console.log('Token price > 0');
      console.log('Amount qualified', amountQualified);
      return amountQualified.div(tokenPrice);
    } else {
      console.log('Token price = 0');
      console.log('Supply', supply);
      tokenPrice = amountQualified.div(supply);
      console.log('Token price', tokenPrice);
      return supply;
    }
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
