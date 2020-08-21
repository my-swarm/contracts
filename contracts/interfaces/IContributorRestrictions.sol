pragma solidity ^0.5.0;

contract IContributorRestrictions {

    event AccountWhitelisted(address account, address authority);
    event AccountUnWhitelisted(address account, address authority);

    function maxContributors() external view returns (uint);
    function minInvestmentAmount() external view returns (uint);
    function maxInvestmentAmount() external view returns (uint);
    function checkMinInvestment(uint amount) external view returns (bool);
    function checkMaxInvestment(uint amount) external view returns (bool);
    function checkMaxContributors() external view returns (bool);
    function checkRestrictions(address account) external view returns (bool);
    function isWhitelisted(address account) external view returns (bool);
    function whitelistAccount(address account) external;
    function unWhitelistAccount(address account) external;
    function bulkWhitelistAccount(address[] calldata accounts) external;
    function bulkUnWhitelistAccount(address[] calldata accounts) external;
}
