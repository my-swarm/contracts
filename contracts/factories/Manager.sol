pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/ISRC20.sol';
import '../interfaces/ISRC20Managed.sol';
import '../interfaces/ISRC20Roles.sol';
import '../interfaces/IManager.sol';

/**
 * @dev Manager handles SRC20 burn/mint in relation to
 * SWM token staking.
 */
contract Manager is IManager, Ownable {
  using SafeMath for uint256;

  mapping(address => SRC20) internal registry;

  struct SRC20 {
    address owner;
    address roles;
    uint256 stake;
    address minter;
  }

  IERC20 private swmERC20;

  constructor(address _swmERC20) public {
    require(_swmERC20 != address(0), 'SWM ERC20 is zero address');

    swmERC20 = IERC20(_swmERC20);
  }

  modifier onlyTokenOwner(address _src20) {
    require(_isTokenOwner(_src20), 'Caller not token owner.');
    _;
  }

  // Note that, similarly to the role of token owner, there is only one manager per src20 token contract.
  // Only one address can have this role.
  modifier onlyMinter(address _src20) {
    require(msg.sender == registry[_src20].minter, 'Caller not token minter.');
    _;
  }

  /**
   * @dev Mint additional supply of SRC20 tokens based on SWN token stake.
   * Can be used for initial supply and subsequent minting of new SRC20 tokens.
   * When used, Manager will update SWM/SRC20 values in this call and use it
   * for token owner's incStake/decStake calls, minting/burning SRC20 based on
   * current SWM/SRC20 ratio.
   * Only owner of this contract can invoke this method. Owner is SWARM controlled
   * address.
   * Emits SRC20SupplyMinted event.
   *
   * @param _src20 SRC20 token address.
   * @param _swmAccount SWM ERC20 account holding enough SWM tokens (>= swmAmount)
   * with manager contract address approved to transferFrom.
   * @param _swmAmount SWM stake value.
   * @param _src20Amount SRC20 tokens to mint
   * @return true on success.
   * todo: do we even need this method? the increaseSupply one does the same and computes stake too
   * todo: the difference is that this one is called by getRateMinter
   */
  function mintSupply(
    address _src20,
    address _swmAccount,
    uint256 _swmAmount,
    uint256 _src20Amount
  ) external onlyMinter(_src20) returns (bool) {
    require(_swmAccount != address(0), 'SWM account address is zero');
    require(_swmAmount != 0, 'SWM amount is zero');
    require(_src20Amount != 0, 'SRC20 amount is zero');
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    require(swmERC20.transferFrom(_swmAccount, address(this), _swmAmount));
    require(ISRC20Managed(_src20).mint(registry[_src20].owner, _src20Amount));
    registry[_src20].stake = registry[_src20].stake.add(_swmAmount);

    emit SRC20SupplyIncreased(_src20, _swmAccount, _swmAmount, _src20Amount);

    return true;
  }

  /**
   * @dev This is function token issuer can call in order to increase his SRC20 supply this
   * and stake his tokens.
   *
   * @param _src20 Address of src20 token contract
   * @param _swmAccount Account from which stake tokens are going to be deducted
   * @param _src20Amount Value of desired SRC20 token value
   * @return true if success
   * todo: isn't swmAccount always the sender? why whould I increase from someone elses wallet?
   */
  function increaseSupply(
    address _src20,
    address _swmAccount,
    uint256 _src20Amount
  ) external onlyTokenOwner(_src20) returns (bool) {
    require(_swmAccount != address(0), 'SWM account is zero');
    require(_src20Amount != 0, 'SWM value is zero');
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    // computed with the same ratio as in original mint
    uint256 swmAmount = _swmNeeded(_src20, _src20Amount);

    require(swmERC20.transferFrom(_swmAccount, address(this), swmAmount));
    require(ISRC20Managed(_src20).mint(registry[_src20].owner, _src20Amount));
    registry[_src20].stake = registry[_src20].stake.add(swmAmount);

    emit SRC20SupplyIncreased(_src20, _swmAccount, swmAmount, _src20Amount);

    return true;
  }

  /**
   * @dev This is function token issuer can call in order to decrease his SRC20 supply
   * and his stake back
   *
   * @param _src20 Address of src20 token contract
   * @param _swmAccount Account to which stake tokens will be returned
   * @param _src20Amount Value of desired SRC20 token value
   * @return true if success
   */
  function decreaseSupply(
    address _src20,
    address _swmAccount,
    uint256 _src20Amount
  ) external onlyTokenOwner(_src20) returns (bool) {
    require(_swmAccount != address(0), 'SWM account is zero');
    require(_src20Amount != 0, 'SWM value is zero');
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    uint256 swmAmount = _swmNeeded(_src20, _src20Amount);

    require(swmERC20.transfer(_swmAccount, swmAmount));
    require(ISRC20Managed(_src20).burn(registry[_src20].owner, _src20Amount));
    registry[_src20].stake = registry[_src20].stake.sub(swmAmount);

    emit SRC20SupplyDecreased(_src20, _swmAccount, swmAmount, _src20Amount);

    return true;
  }

  /**
   * @dev Allows manager to renounce management.
   *
   * @param _src20 SRC20 token address.
   * @return true on success.
   */
  function renounceManagement(address _src20) external onlyOwner returns (bool) {
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    require(ISRC20Roles(registry[_src20].roles).renounceManagement());

    return true;
  }

  /**
   * @dev Allows manager to transfer management to another address.
   *
   * @param _src20 SRC20 token address.
   * @param _newManager New manager address.
   * @return true on success.
   */
  function transferManagement(address _src20, address _newManager) public onlyOwner returns (bool) {
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');
    require(_newManager != address(0), 'newManager address is zero');

    require(ISRC20Roles(registry[_src20].roles).transferManagement(_newManager));

    return true;
  }

  /**
   * @dev External function allowing consumers to check corresponding SRC20 amount
   * to supplied SWM amount.
   *
   * @param _src20 SRC20 token to check for.this
   * @param _swmAmount SWM value.
   * @return Amount of SRC20 tokens.
   */
  function calcTokens(address _src20, uint256 _swmAmount) external view returns (uint256) {
    return _calcTokens(_src20, _swmAmount);
  }

  /**
   * @dev External view function for calculating SWM tokens needed for increasing/decreasing
   * src20 token supply.
   *
   * @param _src20 Address of src20 contract
   * @param _src20Amount Amount of src20 tokens.this
   * @return Amount of SWM tokens
   */
  function swmNeeded(address _src20, uint256 _src20Amount) external view returns (uint256) {
    return _swmNeeded(_src20, _src20Amount);
  }

  /**
   * @dev External function for calculating how much SWM tokens are needed to be staked
   * in order to get 1 SRC20 token
   *
   * @param _src20 Address of src20 token contract
   * @return Amount of SWM tokens
   */
  function getSrc20toSwmRatio(address _src20) external returns (uint256) {
    uint256 totalSupply = ISRC20(_src20).totalSupply();
    return totalSupply.mul(10**18).div(registry[_src20].stake);
  }

  /**
   * @dev External view function to get current SWM stake
   *
   * @param _src20 Address of SRC20 token contract
   * @return Current stake in wei SWM tokens
   */
  function getStake(address _src20) external view returns (uint256) {
    return registry[_src20].stake;
  }

  /**
   * @dev Get address of token owner
   *
   * @param _src20 Address of SRC20 token contract
   * @return Address of token owner
   */
  function getTokenOwner(address _src20) external view returns (address) {
    return registry[_src20].owner;
  }

  /**
   * @dev Internal function calculating new SRC20 values based on minted ones. On every
   * new minting of supply new SWM and SRC20 values are saved for further calculations.
   *
   * @param _src20 SRC20 token address.
   * @param _swmAmount SWM stake value.
   * @return Amount of SRC20 tokens.
   */
  function _calcTokens(address _src20, uint256 _swmAmount) internal view returns (uint256) {
    require(_src20 != address(0), 'Token address is zero');
    require(_swmAmount != 0, 'SWM value is zero');
    require(registry[_src20].owner != address(0), 'SRC20 token contract not registered');

    uint256 totalSupply = ISRC20(_src20).totalSupply();

    return _swmAmount.mul(totalSupply).div(registry[_src20].stake);
  }

  function _swmNeeded(address _src20, uint256 _src20Amount) internal view returns (uint256) {
    uint256 totalSupply = ISRC20(_src20).totalSupply();
    return _src20Amount.mul(registry[_src20].stake).div(totalSupply);
  }

  /**
   * @return true if `msg.sender` is the token owner of the registered SRC20 contract.
   */
  function _isTokenOwner(address _src20) internal view returns (bool) {
    return msg.sender == registry[_src20].owner;
  }
}
