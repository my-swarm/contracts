pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import '../roles/DelegateRole.sol';

/**
 * @title AffiliateManager
 *
 * Serves to implement all functionality related to managing Affiliates,
 * Affiliate links, etc
 */
contract AffiliateManager is Ownable, DelegateRole {
  struct Affiliate {
    string affiliateLink;
    uint256 percentage;
  }

  mapping(string => address) private affiliateLinks;
  mapping(address => Affiliate) private affiliates;

  /**
   *  Set up an Affiliate. Can be done by the Token Issuer at any time
   *  Setting up the same affiliate again changes his parameters
   *  The contributions are then available to be withdrawn by contributors
   *
   *  @return true on success
   */
  function setupAffiliate(
    address _affiliate,
    string calldata _affiliateLink,
    uint256 _percentage // multiply by 100 => 5 = 0.5%
  ) external onlyOwner() returns (bool) {
    require(_percentage <= 100, 'Percentage greater than 100 not allowed');
    require(_percentage > 0, 'Percentage has to be greater than 0');
    affiliates[_affiliate].affiliateLink = _affiliateLink;
    affiliates[_affiliate].percentage = _percentage;
    affiliateLinks[_affiliateLink] = _affiliate;

    return true;
  }

  /**
   *  Remove an Affiliate. Can be done by the Token Issuer at any time
   *  Any funds he received while active still remain assigned to him.
   *  @param _affiliate the address of the affiliate being removed
   *
   *  @return true on success
   */
  function removeAffiliate(address _affiliate) external onlyOwner() returns (bool) {
    require(affiliates[_affiliate].percentage != 0, 'Affiliate not exist');
    affiliateLinks[affiliates[_affiliate].affiliateLink] = address(0x0);
    delete (affiliates[_affiliate]);
    return true;
  }

  /**
   *  Get information about an Affiliate.
   *  @param _affiliateLink the address of the affiliate being removed
   *
   *  @return true on success
   */
  function getAffiliate(string calldata _affiliateLink) external view returns (address, uint256) {
    return (affiliateLinks[_affiliateLink], affiliates[affiliateLinks[_affiliateLink]].percentage);
  }

  function getAffiliateLink(address _affiliate) external view returns (string memory) {
    return affiliates[_affiliate].affiliateLink;
  }
}
