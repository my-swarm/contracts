pragma solidity ^0.5.0;

contract IContributorRestrictions {
  function maxContributors() external view returns (uint256);

  function minInvestmentAmount() external view returns (uint256);

  function maxInvestmentAmount() external view returns (uint256);

  function checkMinInvestment(uint256 amount) external view returns (bool);

  function checkMaxInvestment(uint256 amount) external view returns (bool);

  function checkMaxContributors() external view returns (bool);

  function checkRestrictions(address account) external view returns (bool);

  function isWhitelisted(address account) external view returns (bool);

  function whitelistAccount(address account) external;

  function unWhitelistAccount(address account) external;

  function bulkWhitelistAccount(address[] calldata accounts) external;

  function bulkUnWhitelistAccount(address[] calldata accounts) external;
}
