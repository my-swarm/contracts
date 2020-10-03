pragma solidity ^0.5.0;

/**
 * @title IAffiliateManager
 *
 * Interface for AffiliateManager contracts
 */
interface IAffiliateManager {
  struct Affiliate {
    string affiliateLink;
    uint256 percentage;
  }

  function setupAffiliate(
    address affiliate,
    string calldata affiliateLink,
    uint256 percentage
  ) external returns (bool);

  function removeAffiliate(address affiliate) external returns (bool);

  function getAffiliate(string calldata affiliateLink) external view returns (address, uint256);

  function getAffiliateLink(address affiliate) external view returns (string memory);
}
