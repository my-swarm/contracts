pragma solidity ^0.5.0;

contract IContributorRestrictions {
  function maxCount() external view returns (uint256);

  function minAmount() external view returns (uint256);

  function maxAmount() external view returns (uint256);

  function checkMinInvestment(uint256 _amount) external view returns (bool);

  function checkMaxInvestment(uint256 _amount) external view returns (bool);

  function checkMaxContributors() external view returns (bool);

  function checkRestrictions(address _account) external view returns (bool);

  function isWhitelisted(address _account) external view returns (bool);

  function whitelistAccount(address _account) external;

  function unWhitelistAccount(address _account) external;

  function bulkWhitelistAccount(address[] calldata _accounts) external;

  function bulkUnWhitelistAccount(address[] calldata _accounts) external;
}
