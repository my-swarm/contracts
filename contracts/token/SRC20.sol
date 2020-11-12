pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import '../interfaces/ISRC20.sol';
import '../interfaces/ISRC20Managed.sol';
import '../interfaces/ITransferRules.sol';
import '../interfaces/IFeatures.sol';
import '../interfaces/ISRC20Roles.sol';
import '../interfaces/IAssetRegistry.sol';
import '../fundraising/Fundraiser.sol';

/**
 * @title SRC20 contract
 * @dev Base SRC20 contract.
 */
contract SRC20 is ISRC20, ISRC20Managed, Ownable {
  using SafeMath for uint256;
  using ECDSA for bytes32;

  string public name;
  string public symbol;
  uint8 public decimals;

  mapping(address => uint256) public balances;
  mapping(address => mapping(address => uint256)) public allowances;
  uint256 public totalSupply;
  uint256 public maxTotalSupply;

  ISRC20Roles public roles;
  IFeatures public features;
  IAssetRegistry public assetRegistry;

  /**
   * @description Configured contract implementing token transfer rules.
   * If set, authorizes every transfer. Calls doTransfer() when checks are passed.
   */
  ITransferRules public transferRules;

  address public fundraiser;
  event FundraiserAdded(address fundraiser);

  modifier onlyAuthority() {
    require(roles.isAuthority(msg.sender), 'Caller not authority');
    _;
  }

  modifier onlyDelegate() {
    require(roles.isDelegate(msg.sender), 'Caller not delegate');
    _;
  }

  modifier onlyManager() {
    require(roles.isManager(msg.sender), 'Caller not manager');
    _;
  }

  modifier enabled(uint8 feature) {
    require(features.isEnabled(feature), 'Token feature is not enabled');
    _;
  }

  // Constructors
  // addressList: 0:transferRules, 1:roles, 2:features, 3:assetRegistry, 4: minter
  // note: owner is passed explicitly from the factory, that's why not msg.sender
  constructor(
    address _owner,
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _maxTotalSupply,
    address[] memory _addressList
  ) public {
    _transferOwnership(_owner);
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    maxTotalSupply = _maxTotalSupply;
    _updateTransferRules(_addressList[0]);
    roles = ISRC20Roles(_addressList[1]);
    features = IFeatures(_addressList[2]);
    assetRegistry = IAssetRegistry(_addressList[3]);
  }

  /**
   * Change the transfer rules contract. Only a Delegate can call this role
   *
   * @param _transferRules address implementing on-chain restriction checks
   * @return true on success.
   */
  function updateTransferRules(address _transferRules) external onlyDelegate returns (bool) {
    return _updateTransferRules(_transferRules);
  }

  function transfer(address _to, uint256 _value) external returns (bool) {
    require(features.checkTransfer(msg.sender, _to), 'Cannot transfer due to disabled feature');

    if (transferRules != ITransferRules(0)) {
      require(transferRules.doTransfer(msg.sender, _to, _value), 'Transfer failed');
    } else {
      _transfer(msg.sender, _to, _value);
    }

    return true;
  }

  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  ) public returns (bool) {
    require(features.checkTransfer(_from, _to), 'Feature transfer check');

    _approve(_from, msg.sender, allowances[_from][msg.sender].sub(_value));
    if (transferRules != ITransferRules(0)) {
      require(transferRules.doTransfer(_from, _to, _value), 'Transfer failed');
    } else {
      _transfer(_from, _to, _value);
    }

    return true;
  }

  /**
   * @dev Transfer tokens from one address to another, used by token issuer. This
   * call requires only that from address has enough tokens, all other checks are
   * skipped.
   * Emits Transfer event.
   * Allowed only to token owners. Require 'ForceTransfer' feature enabled.
   *
   * @param _from The address which you want to send tokens from.
   * @param _to The address to send tokens to.
   * @param _value The amount of tokens to send.
   * @return true on success.
   */
  function transferForced(
    address _from,
    address _to,
    uint256 _value
  ) external enabled(features.ForceTransfer()) onlyOwner returns (bool) {
    _transfer(_from, _to, _value);
    return true;
  }

  /**
   * @dev This method is intended to be executed by TransferRules contract when doTransfer is called in transfer
   * and transferFrom methods to check where funds should go.
   *
   * @param _from The address to transfer from.
   * @param _to The address to send tokens to.
   * @param _value The amount of tokens to send.
   */
  function executeTransfer(
    address _from,
    address _to,
    uint256 _value
  ) external onlyAuthority returns (bool) {
    _transfer(_from, _to, _value);
    return true;
  }

  /**
   * Perform multiple token transfers from the token owner's address.
   * The tokens should already be minted. If this function is to be called by
   * an actor other than the owner (a delegate), the owner has to call approve()
   * first to set up the delegate's allowance.
   *
   * @param _addresses an array of addresses to transfer to
   * @param _amounts an array of amounts
   * @return true on success
   */
  function bulkTransfer(address[] calldata _addresses, uint256[] calldata _amounts)
    external
    onlyDelegate
    returns (bool)
  {
    require(_addresses.length == _amounts.length, 'Input dataset length mismatch');

    uint256 count = _addresses.length;
    for (uint256 i = 0; i < count; i++) {
      address to = _addresses[i];
      uint256 value = _amounts[i];
      if (owner() != msg.sender) {
        _approve(owner(), msg.sender, allowances[owner()][msg.sender].sub(value));
      }
      _transfer(owner(), to, value);
    }

    return true;
  }

  // Account token burning management
  /**
   * @dev Function that burns an amount of the token of a given
   * account.
   * Emits Transfer event, with to address set to zero.
   *
   * @return true on success.
   */
  function burnAccount(address _account, uint256 _value)
    external
    enabled(features.AccountBurning())
    onlyOwner
    returns (bool)
  {
    _burn(_account, _value);
    return true;
  }

  // Token managed burning/minting
  /**
   * @dev Function that burns an amount of the token of a given
   * account.
   * Emits Transfer event, with to address set to zero.
   * Allowed only to manager.
   *
   * @return true on success.
   */
  function burn(address _account, uint256 _value) external onlyManager returns (bool) {
    _burn(_account, _value);
    return true;
  }

  /**
   * @dev Function that mints an amount of the token to a given
   * account.
   * Emits Transfer event, with from address set to zero.
   * Allowed only to manager.
   *
   * @return true on success.
   */
  function mint(address _account, uint256 _value) external onlyManager returns (bool) {
    _mint(_account, _value);
    return true;
  }

  // ERC20 part-like interface methods

  /**
   * @dev Gets the balance of the specified address.
   * @param _owner The address to query the balance of.
   * @return A uint256 representing the amount owned by the passed address.
   */
  function balanceOf(address _owner) public view returns (uint256) {
    return balances[_owner];
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(address _owner, address _spender) public view returns (uint256) {
    return allowances[_owner][_spender];
  }

  /**
   * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
   * NOTE: Clients SHOULD make sure to create user interfaces in such a way that
   * they set the allowance first to 0 before setting it to another value for
   * the same spender. THOUGH The contract itself shouldn’t enforce it, to allow
   * backwards compatibility with contracts deployed before
   * Emit Approval event.
   *
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens to be spent.
   */
  function approve(address _spender, uint256 _value) public returns (bool) {
    _approve(msg.sender, _spender, _value);
    return true;
  }

  /**
   * @dev Atomically increase approved tokens to the spender on behalf of msg.sender.
   *
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens that allowance will be increase for.
   */
  function increaseAllowance(address _spender, uint256 _value) external returns (bool) {
    _approve(msg.sender, _spender, allowances[msg.sender][_spender].add(_value));
    return true;
  }

  /**
   * @dev Atomically decrease approved tokens to the spender on behalf of msg.sender.
   *
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens that allowance will be reduced for.
   */
  function decreaseAllowance(address _spender, uint256 _value) external returns (bool) {
    _approve(msg.sender, _spender, allowances[msg.sender][_spender].sub(_value));
    return true;
  }

  function setFundraiser() external returns (bool) {
    require(Fundraiser(msg.sender).token() == address(this), 'Can only call for own token');
    fundraiser = msg.sender;
    emit FundraiserAdded(msg.sender);
    return true;
  }

  // Privates

  /**
   * @dev Transfer token for a specified addresses.
   * @param _from The address to transfer from.
   * @param _to The address to transfer to.
   * @param _value The amount to be transferred.
   */
  function _transfer(
    address _from,
    address _to,
    uint256 _value
  ) internal {
    require(_to != address(0), 'Recipient is zero address');

    balances[_from] = balances[_from].sub(_value);
    balances[_to] = balances[_to].add(_value);

    emit Transfer(_from, _to, _value);
  }

  /**
   * @dev Internal function that burns an amount of the token of a given
   * account.
   * Emit Transfer event.
   * @param _account The account whose tokens will be burnt.
   * @param _value The amount that will be burnt.
   */
  function _burn(address _account, uint256 _value) internal {
    require(_account != address(0), 'burning from zero address');

    totalSupply = totalSupply.sub(_value);
    balances[_account] = balances[_account].sub(_value);

    emit Transfer(_account, address(0), _value);
  }

  /**
   * @dev Internal function that mints an amount of the token on given
   * account.
   * Emit Transfer event.
   *
   * @param _account The account where tokens will be minted.
   * @param _value The amount that will be minted.
   */
  function _mint(address _account, uint256 _value) internal {
    require(_account != address(0), 'minting to zero address');

    totalSupply = totalSupply.add(_value);
    require(
      totalSupply <= maxTotalSupply || maxTotalSupply == 0,
      'trying to mint too many tokens!'
    );

    balances[_account] = balances[_account].add(_value);

    emit Transfer(address(0), _account, _value);
  }

  /**
   * @dev Approve an address to spend another addresses' tokens.
   * NOTE: Clients SHOULD make sure to create user interfaces in such a way that
   * they set the allowance first to 0 before setting it to another value for
   * the same spender. THOUGH The contract itself shouldn’t enforce it, to allow
   * backwards compatibility with contracts deployed before
   * Emit Approval event.
   *
   * @param _owner The address that owns the tokens.
   * @param _spender The address that will spend the tokens.
   * @param _value The number of tokens that can be spent.
   */
  function _approve(
    address _owner,
    address _spender,
    uint256 _value
  ) internal {
    require(_owner != address(0), 'approve from the zero address');
    require(_spender != address(0), 'approve to the zero address');

    allowances[_owner][_spender] = _value;

    emit Approval(_owner, _spender, _value);
  }

  /**
   * @dev Internal function to update the restrictions and rules contracts.
   * Emits RestrictionsAndRulesUpdated event.
   *
   * @param _transferRules address implementing on-chain restriction checks
   * @return true on success.
   */
  function _updateTransferRules(address _transferRules) internal returns (bool) {
    transferRules = ITransferRules(_transferRules);
    if (_transferRules != address(0)) {
      require(transferRules.setSRC(address(this)), 'SRC20 contract already set in transfer rules');
    }

    emit TransferRulesUpdated(_transferRules);
    return true;
  }
}
