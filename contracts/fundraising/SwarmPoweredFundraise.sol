pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IIssuerStakeOfferPool.sol";
import "../interfaces/IGetRateMinter.sol";
import "../interfaces/IUniswap.sol";
import "../interfaces/IContributionRules.sol";
import "../interfaces/IContributorRestrictions.sol";
import "../interfaces/ISRC20.sol";

/**
 * @title The Fundraise Contract
 * This contract allows the deployer to perform a Swarm-Powered Fundraise.
 */
contract SwarmPoweredFundraise {

    using SafeMath for uint256;

    event Contribution(address indexed from, uint256 amount, uint256 sequence, address baseCurrency);

    // Setup variables that never change
    string public label;
    address public src20;
    uint256 public tokenAmount;
    uint256 public startDate;
    uint256 public endDate;
    uint256 public softCap;
    uint256 public hardCap;
    address public baseCurrency;

    uint256 public expirationTime = 7776000; // 60 * 60 * 24 * 90 = ~3months

    bool public contributionLocking = true;

    uint256 public tokenPriceBCY;
    uint256 public totalTokenAmount;
    address zeroAddr = address(0); // 0x0000000000000000000000000000000000000000; // Stands for ETH
    address erc20DAI;
    address erc20USDC;
    address erc20WBTC;
    // IAccCurrency - address accCurrency;

    mapping(address => address) exchange;
    // @TODO abstract away conversions and exchanges to an interface
    // NOTE: bonding curves are not the same as deep markets where any amount barely moves the price

    address SwarmERC20;
    address minter;

    address payable issuerWallet;

    // State variables that change over time
    struct contribution {
        address currency;
        uint256 amount;
        uint256 sequence;
        bool accepted;
    }

    struct AcceptedContribution {
        uint256 amount;
    }

    mapping(address => contribution[]) contributionsList;
    // contributor => currency =? sum
    mapping(address => mapping(address => AcceptedContribution)) accContribution;

    uint256 public sequence;

    bool public isFinished;

    address public contributionRules;
    address public contributorRestrictions;

    modifier onlyContributorRestrictions() {
        require(msg.sender == contributorRestrictions);
        _;
    }

    uint256 acceptedAmountETH;
    uint256 acceptedAmountDAI;
    uint256 acceptedAmountUSDC;
    uint256 acceptedAmountWBTC;

    // @TODO maybe simplify like this
    struct CurrencyStats {
        address exchangeContract;
        uint256 finalExchangeRateETH;
        uint256 totalContributedAmount;
        uint256 totalAcceptedAmount;
    }

    mapping(address => CurrencyStats) currencyStats;

    constructor(
        string memory _label,
        address _src20,
        uint256 _tokenAmount,
        uint256 _startDate,
        uint256 _endDate,
        uint256 _softCap,
        uint256 _hardCap,
        address _baseCurrency
    ) public {
        label = _label;
        src20 = _src20;
        tokenAmount = _tokenAmount;
        startDate = _startDate;
        endDate = _endDate;
        softCap = _softCap;
        hardCap = _hardCap;

        require(_baseCurrency == erc20DAI ||
        _baseCurrency == erc20USDC ||
        _baseCurrency == erc20WBTC ||
        _baseCurrency == zeroAddr, 'Unsupported base currency');

        baseCurrency = _baseCurrency;
    }

    function() external payable {
        require(tokenPriceBCY != 0 || totalTokenAmount != 0, "Contribution failed: token price or total token amount are not set");
        require(block.timestamp >= startDate, "Contribution failed: fundraising did not start");
        require(block.timestamp <= endDate, "Contribution failed: fundraising has ended");

        sequence++;

        contribution memory c;
        c.currency = address(0);
        c.amount = msg.value;
        c.sequence = sequence;

        contributionsList[msg.sender].push(c);

        _acceptContributor(msg.sender);

        emit Contribution(msg.sender, msg.value, sequence, address(0));
    }

    function setTokenPriceBCY(uint256 _tokenPriceBCY) external returns (bool) {
        // One has to be set or the other, never both.
        require(tokenPriceBCY == 0, "Token price already set");
        require(totalTokenAmount == 0, "Total token amount already set");

        tokenPriceBCY = _tokenPriceBCY;
        return true;
    }

    function setTotalTokenAmount(uint256 _totalTokenAmount) external returns (bool) {
        require(tokenPriceBCY == 0, "Token price already set");
        require(totalTokenAmount == 0, "Total token amount already set");

        totalTokenAmount = _totalTokenAmount;
        return true;
    }

    function contribute(address erc20, uint256 amount) public returns (bool) {
        require((tokenPriceBCY != 0 || totalTokenAmount != 0), "Contribution failed: token price or total token amount are not set");
        require(block.timestamp >= startDate, "Contribution failed: fundraising did not start");
        require(block.timestamp <= endDate, "Contribution failed: fundraising has ended");
        require(IERC20(erc20).transferFrom(msg.sender, address(this), amount), 'Contribution failed: ERC20 transfer failed!');

        sequence++;

        contribution memory c;
        c.currency = erc20;
        c.amount = amount;
        c.sequence = sequence;

        contributionsList[msg.sender].push(c);

        _acceptContributor(msg.sender);

        emit Contribution(msg.sender, amount, sequence, erc20);

        return true;
    }

    function withdrawContributionETH() external returns (bool) {
        require(isFinished == true && block.timestamp < endDate.add(expirationTime), 'Withdrawal failed: fundraise has not finished');

        for (uint256 i = 0; i < contributionsList[msg.sender].length; i++) {
            if (contributionsList[msg.sender][i].currency != address(0))
                continue;
            msg.sender.transfer(contributionsList[msg.sender][i].amount);
        }

        delete contributionsList[msg.sender];

        return true;
    }

    function withdrawContributionToken() external returns (bool) {
        require(isFinished == true && block.timestamp < endDate.add(expirationTime), 'Withdrawal failed: fundraise has not finished');

        for (uint256 i = 0; i < contributionsList[msg.sender].length; i++) {
            if (contributionsList[msg.sender][i].currency == address(0))
                continue;
            // Transfer from
            require(IERC20(contributionsList[msg.sender][i].currency).transferFrom(
                    address(this),
                    msg.sender,
                    contributionsList[msg.sender][i].amount),
                'ERC20 transfer failed!');
        }

        delete contributionsList[msg.sender];

        return true;
    }

    function allowContributionWithdrawals() external returns (bool) {
        delete contributionLocking;
        return true;
    }

    function setPresale(uint256 amountBCY, uint256 tokens) external pure returns (bool) {
        return true;
    }

    function getPresale() external pure returns (uint256, uint256) {
        return (0, 0);
    }

    function finishFundraising() external returns (bool) {
        require(isFinished == false, "Failed to finish fundraising: Fundraising already finished");
        require(block.timestamp < endDate.add(expirationTime), "Failed to finish fundraising: expiration time passed");

        uint256 totalContributionsBCY = toBCY(acceptedAmountETH, zeroAddr) +
        toBCY(acceptedAmountDAI, erc20DAI) +
        toBCY(acceptedAmountUSDC, erc20USDC) +
        toBCY(acceptedAmountWBTC, erc20WBTC);

        require(totalContributionsBCY >= toBCY(softCap, erc20USDC));

        // @TODO _lockRate()

        isFinished = true;

        return true;
    }

    function setContributionRules(address rules) external returns (bool) {
        require(contributionRules != address(0), "Contribution rules already set");

        contributionRules = rules;
        return true;
    }

    function setContributorRestrictions(address restrictions) external returns (bool) {
        require(contributorRestrictions != address(0), "Contributor restrictions already set");

        contributorRestrictions = restrictions;
        return true;
    }

    function getHistoricalBalanceETH(uint256 _sequence) external pure returns (uint256) {
        return uint256(0);
    }

    function isContributionAccepted(uint256 _sequence) external pure returns (bool) {
        return true;
    }

    function acceptContributor(address contributor) external onlyContributorRestrictions returns (bool) {
        _acceptContributor(contributor);
        return true;
    }

    function rejectContributor(address contributor) external onlyContributorRestrictions returns (bool) {
        _rejectContributor(contributor);
        return true;
    }

    function _acceptContributor(address contributor) internal returns (bool) {
        require(IContributorRestrictions(contributorRestrictions).checkContributor(contributor));

        uint256 totalContributorAcceptedBCY;
        for (uint256 i = 0; i < contributionsList[msg.sender].length; i++) {
            if (
                contributionsList[msg.sender][i].accepted ||
                IContributionRules(contributionRules).checkContribution(totalContributorAcceptedBCY)
            ) {
                continue;
            }

            contribution memory contr = contributionsList[msg.sender][i];

            accContribution[contributor][contr.currency].amount =
            accContribution[contributor][contr.currency].amount.add(
                contr.amount);

            totalContributorAcceptedBCY = toBCY(accContribution[contributor][zeroAddr].amount, zeroAddr).add(
                toBCY(accContribution[contributor][erc20DAI].amount, erc20DAI)).add(
                toBCY(accContribution[contributor][erc20USDC].amount, erc20USDC)).add(
                toBCY(accContribution[contributor][erc20WBTC].amount, erc20WBTC));

            _addToLumpSum(contr.currency, contr.amount);
            contributionsList[msg.sender][i].accepted = true;
        }

        return true;
    }

    function _rejectContributor(address contributor) internal returns (bool) {
        require(!IContributorRestrictions(contributorRestrictions).checkContributor(contributor));

        for (uint256 i = contributionsList[msg.sender].length - 1; i >= 0; i--) {
            if (!contributionsList[msg.sender][i].accepted) {
                continue;
            }

            contribution memory contr = contributionsList[msg.sender][i];

            accContribution[contributor][contr.currency].amount =
            accContribution[contributor][contr.currency].amount.sub(
                contr.amount);

            delete contributionsList[msg.sender][i].accepted;
            _subFromLumpSum(contr.currency, contr.amount);
        }

        return true;
    }

    // @TODO expose function to claim tokens
    // Returns 0 if all tokens have been claimed, an integer if more are left
    function claimTokens() external returns (uint256) {
        uint256 totalContributorAcceptedBCY =
        toBCY(accContribution[msg.sender][zeroAddr].amount, zeroAddr) +
        toBCY(accContribution[msg.sender][erc20DAI].amount, erc20DAI) +
        toBCY(accContribution[msg.sender][erc20USDC].amount, erc20USDC) +
        toBCY(accContribution[msg.sender][erc20WBTC].amount, erc20WBTC);

        uint256 totalAcceptedBCY =
        toBCY(acceptedAmountETH, zeroAddr) +
        toBCY(acceptedAmountDAI, erc20DAI) +
        toBCY(acceptedAmountUSDC, erc20USDC) +
        toBCY(acceptedAmountWBTC, erc20WBTC);

        tokenPriceBCY = tokenPriceBCY > 0 ? tokenPriceBCY : totalAcceptedBCY / totalTokenAmount;
        uint256 tokenAllotment = totalContributorAcceptedBCY / tokenPriceBCY;

        ISRC20(src20).transfer(msg.sender, tokenAllotment);
        return 0;
    }

    function stakeAndMint(address ISOP) external returns (bool) {
        address[] memory a;
        stakeAndMint(ISOP, a);

        return true;
    }

    function stakeAndMint(address ISOP, address[] memory addressList) public returns (bool) {
        require(isFinished);

        // Mint
        uint256 totalContributionsBCY = toBCY(acceptedAmountETH, zeroAddr) +
        toBCY(acceptedAmountDAI, erc20DAI) +
        toBCY(acceptedAmountUSDC, erc20USDC) +
        toBCY(acceptedAmountWBTC, erc20WBTC);


        require(totalContributionsBCY >= toBCY(softCap, erc20USDC));
        // softCap is by default in USD so we will need a way to get a price of BCY to USD - the easiest is to get it from DAI or USDC.

        // @TODO convert all to SafeMath when happy with logic
        // @TODO Update the NAV
        // assetRegistry.updateNetAssetValueUSD(src20, netAssetValueUSD);
        uint256 netAssetValueUSD = softCap;
        uint256 swmAmount = IGetRateMinter(minter).calcStake(netAssetValueUSD);

        // Collect the SWM tokens from ISOP. For now we don't loop but only have
        // One provider, chosen by the Token Issuer
        // @TODO loop through providers
        address swmProvider = addressList[0];
        uint256 priceETH = IIssuerStakeOfferPool(ISOP).getSWMPriceETH(swmProvider, swmAmount);
        IIssuerStakeOfferPool(ISOP).buySWMTokens.value(priceETH)(swmProvider, swmAmount);

        // SWM are on the Fundraise contract, approve the minter to spend them

        // this needs to be called by ISOP, because ISOP is owner of the tokens
        IERC20(SwarmERC20).approve(minter, swmAmount);

        uint256 numSRC20Tokens = totalTokenAmount > 0 ? totalTokenAmount : totalContributionsBCY / tokenPriceBCY;
        IGetRateMinter(minter).stakeAndMint(src20, numSRC20Tokens);

        // Withdraw
        // Withdraw accepted ETH, minus the amount spent to buy SWM tokens
        issuerWallet.transfer(acceptedAmountETH - priceETH);

        // Withdraw accepted DAI
        //        IERC20(erc20DAI).approve(issuerWallet, acceptedAmountDAI);
        IERC20(erc20DAI).transfer(issuerWallet, acceptedAmountDAI);

        // Withdraw accepted USDC
        //        IERC20(erc20USDC).approve(issuerWallet, acceptedAmountUSDC);
        IERC20(erc20USDC).transfer(issuerWallet, acceptedAmountUSDC);

        // Withdraw accepted WBTC
        //        IERC20(erc20WBTC).approve(issuerWallet, acceptedAmountWBTC);
        IERC20(erc20WBTC).transfer(issuerWallet, acceptedAmountWBTC);

        return true;

    }

    // Convert an amount in currency into an amount in base currency
    function toBCY(uint256 amount, address currency) public returns (uint256) {

        // @TODO lock rates when Fundraise finishes

        uint256 amountETH;
        uint256 amountBCY;

        // If same, just return the input
        if (currency == baseCurrency)
            return amount;

        // ERC20 - ETH
        if (baseCurrency == zeroAddr) {
            amountBCY = IUniswap(exchange[currency]).getTokenToEthInputPrice(amount);
            return amountBCY;
        }

        // ETH - ERC20
        if (currency == zeroAddr) {
            amountBCY = IUniswap(exchange[baseCurrency]).getEthToTokenInputPrice(amount);
            return amountBCY;
        }

        // ERC20 - ERC20
        amountETH = IUniswap(exchange[currency]).getTokenToEthInputPrice(amount);
        amountBCY = IUniswap(exchange[baseCurrency]).getEthToTokenInputPrice(amountETH);
        return amountBCY;

    }

    function _addToLumpSum(address currency, uint256 amount) internal returns (bool){
        if (currency == zeroAddr) {
            acceptedAmountETH = acceptedAmountETH.add(amount);
        } else if (currency == erc20DAI) {
            acceptedAmountDAI = acceptedAmountDAI.add(amount);
        } else if (currency == erc20USDC) {
            acceptedAmountUSDC = acceptedAmountUSDC.add(amount);
        } else if (currency == erc20WBTC) {
            acceptedAmountWBTC = acceptedAmountWBTC.add(amount);
        }

        return true;
    }

    function _subFromLumpSum(address currency, uint256 amount) internal returns (bool) {
        if (currency == zeroAddr) {
            acceptedAmountETH = acceptedAmountETH.sub(amount);
        } else if (currency == erc20DAI) {
            acceptedAmountDAI = acceptedAmountDAI.sub(amount);
        } else if (currency == erc20USDC) {
            acceptedAmountUSDC = acceptedAmountUSDC.sub(amount);
        } else if (currency == erc20WBTC) {
            acceptedAmountWBTC = acceptedAmountWBTC.sub(amount);
        }

        return true;
    }

    function _lockRate() internal returns (bool) {
        return true;
    }

    // @TODO stakeAndMint without IssuerStakeOfferPool
}