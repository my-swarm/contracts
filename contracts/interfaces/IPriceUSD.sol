// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

/**
    @title interface for exchange rate provider contracts
 */
interface IPriceUSD {
  function getPrice() external view returns (uint256 numerator, uint256 denominator);
}
