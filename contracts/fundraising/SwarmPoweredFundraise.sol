pragma solidity ^0.5.10;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IGetRateMinter.sol';
import '../interfaces/IAffiliateManager.sol';
import '../interfaces/IContributorRestrictions.sol';

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract SwarmPoweredFundraise {
  using SafeMath for uint256;

  event ContributionReceived(address indexed account, uint256 amount);
  event ContributionRefunded(address indexed account, uint256 amount);
  event ContributorAccepted(address account);
  event ContributorRemoved(address account);
  event TokensClaimed(address indexed account, uint256 amount);
  event FundsWithdrawal(address indexed account, uint256 amount);
  event ReferralCollected(address indexed account, uint256 amount);

  // variables that are set up once and never change
  string public label;
  address private owner;
  uint256 public startDate;
  uint256 public endDate;
  uint256 public expirationTime = 2592000; // default: 60 * 60 * 24 * 30 = ~1month
  uint256 public fee = 2000e6; // USDC has 6 decimal places
  address public token;
  address public minter;
  address public affiliateManager;
  address public contributorRestrictions;
  address public baseCurrency = 0xCa5A93FA0812992C0e1B6cf0A63e189dc682F542; //= 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // USDC Mainnet
  uint256 public softCap;
  uint256 public hardCap;
  uint256 public tokenPrice;
  uint256 public tokensToMint;
  uint256 public fundraiseAmount;

  // variables that keep track of state
  uint256 public numberOfContributors;
  uint256 public totalFundsWithdrawal;
  uint256 public qualifiedSums;
  uint256 public bufferedSums;
  bool public isFinished;
  bool public isCancelled;
  bool public setupCompleted;
  bool public hardCapReached;
  bool public contributionsLocked = true;

  // per contributor, these are contributors that have not been whitelisted yet
  mapping(address => uint256) public bufferedContributions;

  // per whitelisted contributor, qualified amount
  // a qualified amount is an amount that has passed min/max checks
  mapping(address => uint256) public qualifiedContributions;

  // contributors who has been whitelisted and contributed funds
  mapping(address => bool) public activeContributor;

  // referral link of contributor
  mapping(address => address) public referral;

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
    require(setupCompleted, 'Fundraise setup not completed');
    require(!isFinished, 'Fundraise has finished');
    require(!hardCapReached, 'HardCap has been reached');
    require(block.timestamp >= startDate, 'Fundraise has not started yet');
    require(block.timestamp <= endDate, 'Fundraise has ended');
    return true;
  }

  /**
   *  Pass all the most important parameters that define the Fundraise
   *  All variables cannot be in the constructor because we get "stack too deep" error
   *  After deployment setupContract() function needs to be called to set them up
   */
  constructor(
    string memory _label,
    address _token,
    uint256 _tokensToMint,
    uint256 _startDate,
    uint256 _endDate,
    uint256 _softCap,
    uint256 _hardCap
  ) public {
    require(_hardCap >= _softCap, 'Hardcap has to be >= Softcap');
    owner = msg.sender;
    label = _label;
    token = _token;
    tokensToMint = _tokensToMint;
    startDate = _startDate;
    endDate = _endDate;
    softCap = _softCap;
    hardCap = _hardCap;
  }

  /**
   *  Set up additional parameters that didn't fit in the constructor
   *  All variables cannot be in the constructor because we get "stack too deep" error
   *  NOTE : If tokenPrice is not zero, tokensToMint is ignored
   */
  function setupContract(
    address _baseCurrency,
    uint256 _tokenPrice,
    address _affiliateManager,
    address _contributorRestrictions,
    address _minter,
    bool _contributionsLocked
  ) external onlyOwner() {
    require(_tokenPrice > 0 || tokensToMint > 0, 'Either price or amount to mint is needed');
    require(!setupCompleted, 'Contract is already set up');
    require(!isCancelled, 'Fundsraiser is cancelled');
    require(block.timestamp < startDate, 'Set up should be done before start date');

    baseCurrency = _baseCurrency;
    tokenPrice = _tokenPrice;
    affiliateManager = _affiliateManager;
    contributorRestrictions = _contributorRestrictions;
    contributionsLocked = _contributionsLocked;
    minter = _minter;
    setupCompleted = true;
  }

  /**
   *  Cancel the fundraise. Can be done by the Token Issuer at any time
   *  The contributions are then available to be withdrawn by contributors
   *
   *  @return true on success
   */
  function cancelFundraise() external onlyOwner() returns (bool) {
    isCancelled = true;
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
    uint256 amount = bufferedContributions[contributor];
    // process contribution
    if (amount > 0) {
      bufferedContributions[contributor] = 0;
      bufferedSums = bufferedSums.sub(amount);
      string memory link = IAffiliateManager(affiliateManager).getAffiliateLink(
        referral[contributor]
      );
      _contribute(contributor, amount, link);
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
      isCancelled == true ||
        block.timestamp > endDate.add(expirationTime) ||
        contributionsLocked == false,
      'Fundraise has not finished!'
    );
    if (contributionsLocked == false) {
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
    _withdrawRaisedFunds(msg.sender);
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
    _addAffiliate(contributor, affiliateLink, amount);

    // checks if contribution amount meets minimum requirements
    if (!IContributorRestrictions(contributorRestrictions).checkMinInvestment(amount)) {
      return false;
    }

    // check if user is whitelisted
    if (IContributorRestrictions(contributorRestrictions).isWhitelisted(contributor)) {
      _addContributor(contributor);
      uint256 refund = _updateContributions(
        contributor,
        amount,
        true
      );
      (bool pass, uint256 overAmount) = _checkHardCap(qualifiedContributions[contributor]);
      if (overAmount > 0 || refund > 0) {
        uint256 totalRefund = overAmount.add(refund);
        _refund(contributor, totalRefund);
      }
      if (pass) {
        hardCapReached = true;
      }
    } else {
      _updateContributions(contributor, amount, false);
    }

    // @cicnos check if raise has reached cap
    // check if qualifiedSums meet criteria
    emit ContributionReceived(contributor, amount);
    return true;
  }

  function _addContributor(address user) internal {
    if (!activeContributor[user]) {
      numberOfContributors = numberOfContributors.add(1);
      activeContributor[user] = true;
    }
  }

  function _removeContributor(address user) internal {
    if (activeContributor[user]) {
      numberOfContributors = numberOfContributors.sub(1);
      activeContributor[user] = false;
    }
  }

  /**
   *  Updates investor contributions
   *
   *  NOTE: this skips the minAmount checks!
   *  NOTE: the maxAmount check is still performed
   *
   *  @param contributor the address of the contributor we are processing
   *         buffered contributions for
   *  @return value that is above the max investment amount
   */
  function _updateContributions(
    address contributor,
    uint256 amount,
    bool qualified
  ) internal returns (uint256) {
    uint256 maxInvestment = IContributorRestrictions(contributorRestrictions).minInvestmentAmount();
    uint256 refund;
    if (
      maxInvestment == 0 ||
      IContributorRestrictions(contributorRestrictions).checkMaxInvestment(amount)
    ) {
      if (qualified) {
        qualifiedContributions[contributor] = qualifiedContributions[contributor].add(amount);
        qualifiedSums = qualifiedSums.add(amount);
      } else {
        bufferedContributions[contributor] = bufferedContributions[contributor].add(amount);
        bufferedSums = bufferedSums.add(amount);
      }
      refund = 0;
    } else {
      if (qualified) {
        refund = (qualifiedContributions[contributor]).sub(maxInvestment);
        qualifiedContributions[contributor] = maxInvestment;
      } else {
        refund = (bufferedContributions[contributor]).sub(maxInvestment);
        bufferedContributions[contributor] = maxInvestment;
      }
    }
    return refund;
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
        if (referral[user] == address(0) || referral[user] == affiliate) {
          referral[user] = affiliate;
          uint256 claim = amount.mul(percentage).div(100);
          affiliateClaim[user] = affiliateClaim[user].add(claim);
          totalAffiliateClaim[affiliate] = totalAffiliateClaim[affiliate].add(claim);
        }
      }
    }
  }

  function _removeAffiliate(address user) internal {
    if (referral[user] != address(0)) {
      totalAffiliateClaim[referral[user]] = totalAffiliateClaim[referral[user]].sub(
        affiliateClaim[user]
      );
      affiliateClaim[user] = 0;
      referral[user] = address(0);
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
    require(qualifiedSums >= softCap, 'SoftCap not reached');

    if (qualifiedSums < hardCap && block.timestamp < endDate) {
      revert('Softcap is only valid after end date');
    }
    // lock the fundraise amount... it will be somewhere between the soft and hard caps
    contributionsLocked = true;
    isFinished = true;
    fundraiseAmount = qualifiedSums;

    // find out the token price
    if (tokenPrice > 0) return fundraiseAmount.div(tokenPrice);
    else {
      tokenPrice = fundraiseAmount.div(tokensToMint);
      return tokensToMint;
    }
  }

  /**
   *  Loop through the accepted currencies and initiate a withdrawal for
   *  each currency, sending the funds to the Token Issuer
   *
   *  @return true on success
   */
  function _withdrawRaisedFunds(address user) internal returns (bool) {
    uint256 amount = qualifiedSums;
    qualifiedSums = 0;
    totalFundsWithdrawal = amount;

    require(IERC20(baseCurrency).transfer(user, amount), 'ERC20 transfer failed');
    emit FundsWithdrawal(user, amount);

    return true;
  }

  function _fullRefund(address user) internal returns (bool) {
    uint256 amount = qualifiedContributions[user].add(bufferedContributions[user]);

    if (amount > 0) {
      qualifiedSums = qualifiedSums.sub(qualifiedContributions[user]);
      bufferedSums = bufferedSums.sub(bufferedContributions[user]);
      delete qualifiedContributions[user];
      delete bufferedContributions[user];
      _refund(user, amount);
      return true;
    } else {
      return false;
    }
  }

  function _refund(address contributor, uint256 amount) internal returns (bool) {
    require(IERC20(baseCurrency).transfer(contributor, amount), 'ERC20 transfer failed!');

    emit ContributionRefunded(contributor, amount);
    return true;
  }
}
