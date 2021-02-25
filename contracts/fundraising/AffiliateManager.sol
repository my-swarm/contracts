// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title AffiliateManager
 *
 * Serves to implement all functionality related to managing Affiliates,
 * Affiliate links, etc
 */
contract AffiliateManager is Ownable {
  struct Affiliate {
    string referral;
    uint256 percentage; // NOTE: percentage is treated as a decimal with 4 decimals
  }

  // mapping of referral ("link") to affiliate address
  mapping(string => address) private referrals;

  // mapping of affiliate address to it's setup
  mapping(address => Affiliate) private affiliates;

  event AffiliateAddedOrUpdated(address account, string referral, uint256 percentage);
  event AffiliateRemoved(address account);

  /**
   *  Adds or updates an Affiliate. Can be done by the Token Issuer at any time
   *  @return true on success
   */
  function addOrUpdate(
    address _addr,
    string calldata _referral,
    uint256 _percentage
  ) external onlyOwner() returns (bool) {
    require(_percentage < 1000000, 'AffiliateManager: Percentage has to be < 100');
    require(_percentage > 0, 'AffiliateManager: Percentage has to be > 0');
    if (affiliates[_addr].percentage != 0) {
      referrals[affiliates[_addr].referral] = address(0x0);
    }
    affiliates[_addr].referral = _referral;
    affiliates[_addr].percentage = _percentage;
    referrals[_referral] = _addr;

    emit AffiliateAddedOrUpdated(_addr, _referral, _percentage);
    return true;
  }

  /**
   *  Remove an Affiliate. Can be done by the Token Issuer at any time
   *  Any funds he received while active still remain assigned to him.
   *  @param _addr the address of the affiliate being removed
   *
   *  @return true on success
   */
  function remove(address _addr) external onlyOwner() returns (bool) {
    require(affiliates[_addr].percentage != 0, 'Affiliate: not found');
    referrals[affiliates[_addr].referral] = address(0x0);
    delete (affiliates[_addr]);

    emit AffiliateRemoved(_addr);
    return true;
  }

  /**
   *  Get information about an Affiliate.
   *  @param _referral the address of the affiliate being removed
   */
  function getByReferral(string calldata _referral) external view returns (address, uint256) {
    address addr = referrals[_referral];
    return (addr, affiliates[addr].percentage);
  }

  function getReferral(address _addr) external view returns (string memory) {
    return affiliates[_addr].referral;
  }
}
