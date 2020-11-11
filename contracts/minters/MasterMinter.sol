pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import '../interfaces/ISRC20Registry.sol';
import '../interfaces/INetAssetValueUSD.sol';

/**
 * @title MasterMinter
 * @dev Serves as proxy (manager) for SRC20 minting/burning.
 * @dev To be called by owner (whoever owns the contract), as opposed to token owner which is the case of TokenMinter
 * @dev Note that this minter can have arbitrary swm/src amount (implies arbitrary swm price)
 */
contract MasterMinter is Ownable {
  ISRC20Registry public registry;

  constructor(address _registry) public {
    registry = ISRC20Registry(_registry);
  }

  /**
   *  This proxy function calls the SRC20Registry function that will do two things
   *  Note: prior to this, the msg.sender has to call approve() on the SWM ERC20 contract
   *        and allow the Manager to withdraw SWM tokens
   *  1. Withdraw the SWM tokens that are required for staking
   *  2. Mint the SRC20 tokens
   *  Only the Owner of the SRC20 token can call this function
   *
   * @param _src20 SRC20 token address.
   * @param _swmAccount SWM ERC20 account holding enough SWM tokens (>= swmAmount)
   * with manager contract address approved to transferFrom.
   * @param _swmAmount SWM stake value.
   * @param _src20Amount SRC20 tokens to mint
   * @return true on success
   */
  function mintSupply(
    address _src20,
    address _swmAccount,
    uint256 _swmAmount,
    uint256 _src20Amount
  ) external onlyOwner returns (bool) {
    require(
      registry.mintSupply(_src20, _swmAccount, _swmAmount, _src20Amount),
      'supply minting failed'
    );

    return true;
  }
}