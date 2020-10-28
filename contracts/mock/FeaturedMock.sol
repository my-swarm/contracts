pragma solidity ^0.5.0;

import '../token/features/Features.sol';

/**
 * @title FeaturesMock contract
 * @dev Features mock contract for tests.
 */
contract FeaturesMock is Features {
  constructor(address owner, uint8 features) public Features(owner, features) {}

  /**
   * @dev Setting up features for test cases.
   */
  function featureEnable(uint8 features) external {
    _enable(features);
  }
}
