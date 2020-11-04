pragma solidity ^0.5.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';
import './SRC20Detailed.sol';
import '../interfaces/ISRC20.sol';
import '../interfaces/ISRC20Managed.sol';
import '../interfaces/ITransferRules.sol';
import '../interfaces/IFeatures.sol';
import '../interfaces/ISRC20Roles.sol';
import '../interfaces/ISRC20.sol';
import '../interfaces/ITransferRestrictions.sol';
import '../interfaces/IAssetRegistry.sol';
import '../fundraising/Fundraiser.sol';

/**
 * @title SRC20 contract
 * @dev Base SRC20 contract.
 */
contract SRC20 is ISRC20, ISRC20Managed, SRC20Detailed, Ownable {
  using SafeMath for uint256;
  using ECDSA for bytes32;

  mapping(address => uint256) public balances;
  mapping(address => mapping(address => uint256)) public allowances;
  uint256 public totalSupply;
  uint256 public maxTotalSupply;

  mapping(address => uint256) private nonce;

  ISRC20Roles public roles;
  IFeatures public features;
  IAssetRegistry public assetRegistry;

  /**
   * @description Configured contract implementing token restriction(s).
   * If set, transferToken will consult this contract should transfer
   * be allowed after successful authorization signature check.
   */
  ITransferRestrictions public restrictions;

  /**
   * @description Configured contract implementing token rule(s).
   * If set, transfer will consult this contract should transfer
   * be allowed after successful authorization signature check.
   * And call doTransfer() in order for rules to decide where fund
   * should end up.
   */
  ITransferRules public rules;

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
  //  addressList[0] tokenOwner,
  //  addressList[1] restrictions,
  //  addressList[2] rules,
  //  addressList[3] roles,
  //  addressList[4] features,
  //  addressList[5] assetRegistry
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _maxTotalSupply,
    address[] memory _addressList
  ) public SRC20Detailed(_name, _symbol, _decimals) {
    maxTotalSupply = _maxTotalSupply;
    _transferOwnership(_addressList[0]);
    _updateRestrictionsAndRules(_addressList[1], _addressList[2]);
    roles = ISRC20Roles(_addressList[3]);
    features = IFeatures(_addressList[4]);
    assetRegistry = IAssetRegistry(_addressList[5]);
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
   * Update the rules and restrictions settings for transfers.
   * Only a Delegate can call this role
   *
   * @param _restrictions address implementing on-chain restriction checks
   * or address(0) if no rules should be checked on chain.
   * @param _rules address implementing on-chain restriction checks
   * @return true on success.
   */
  function updateRestrictionsAndRules(address _restrictions, address _rules)
    external
    onlyDelegate
    returns (bool)
  {
    return _updateRestrictionsAndRules(_restrictions, _rules);
  }

  /**
   * @dev Internal function to update the restrictions and rules contracts.
   * Emits RestrictionsAndRulesUpdated event.
   *
   * @param _restrictions address implementing on-chain restriction checks
   *                     or address(0) if no rules should be checked on chain.
   * @param _rules address implementing on-chain restriction checks
   * @return true on success.
   */
  function _updateRestrictionsAndRules(address _restrictions, address _rules)
    internal
    returns (bool)
  {
    restrictions = ITransferRestrictions(_restrictions);
    rules = ITransferRules(_rules);

    if (_rules != address(0)) {
      require(rules.setSRC(address(this)), 'SRC20 contract already set in transfer rules');
    }

    emit RestrictionsAndRulesUpdated(_restrictions, _rules);
    return true;
  }

  /**
   * @dev Transfer token to specified address. Caller needs to provide authorization
   * signature obtained from MAP API, signed by authority accepted by token issuer.
   * Emits Transfer event.
   *
   * @param _to The address to send tokens to.
   * @param _value The amount of tokens to send.
   * @param _nonce Token transfer nonce, can not repeat nonce for subsequent
   * token transfers.
   * @param _expirationTime Timestamp until transfer request is valid.
   * @param _hash Hash of transfer params (kyaHash, from, to, value, nonce, expirationTime).
   * @param _signature Ethereum ECDSA signature of msgHash signed by one of authorities.
   * @return true on success.
   */
  function transferToken(
    address _to,
    uint256 _value,
    uint256 _nonce,
    uint256 _expirationTime,
    bytes32 _hash,
    bytes calldata _signature
  ) external returns (bool) {
    return _transferToken(msg.sender, _to, _value, _nonce, _expirationTime, _hash, _signature);
  }

  /**
   * @dev Transfer token to specified address. Caller needs to provide authorization
   * signature obtained from MAP API, signed by authority accepted by token issuer.
   * Whole allowance needs to be transferred.
   * Emits Transfer event.
   * Emits Approval event.
   *
   * @param _from The address to transfer from.
   * @param _to The address to send tokens to.
   * @param _value The amount of tokens to send.
   * @param _nonce Token transfer nonce, can not repeat nance for subsequent
   * token transfers.
   * @param _expirationTime Timestamp until transfer request is valid.
   * @param _hash Hash of transfer params (kyaHash, from, to, value, nonce, expirationTime).
   * @param _signature Ethereum ECDSA signature of msgHash signed by one of authorities.
   * @return true on success.
   */
  function transferTokenFrom(
    address _from,
    address _to,
    uint256 _value,
    uint256 _nonce,
    uint256 _expirationTime,
    bytes32 _hash,
    bytes calldata _signature
  ) external returns (bool) {
    _transferToken(_from, _to, _value, _nonce, _expirationTime, _hash, _signature);
    _approve(_from, msg.sender, allowances[_from][msg.sender].sub(_value));
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
  function transferTokenForced(
    address _from,
    address _to,
    uint256 _value
  ) external enabled(features.ForceTransfer()) onlyOwner returns (bool) {
    _transfer(_from, _to, _value);
    return true;
  }

  // Nonce management
  /**
   * @dev Returns next nonce expected by transfer functions that require it.
   * After any successful transfer, nonce will be incremented.
   *
   * @return Nonce for next transfer function.
   */
  function getTransferNonce() external view returns (uint256) {
    return nonce[msg.sender];
  }

  /**
   * @dev Returns nonce for account.
   *
   * @return Nonce for next transfer function.
   */
  function getTransferNonce(address _account) external view returns (uint256) {
    return nonce[_account];
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

  function transfer(address _to, uint256 _value) external returns (bool) {
    require(features.checkTransfer(msg.sender, _to), 'Feature transfer check');

    if (rules != ITransferRules(0)) {
      require(rules.doTransfer(msg.sender, _to, _value), 'Transfer failed');
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

    if (rules != ITransferRules(0)) {
      _approve(_from, msg.sender, allowances[_from][msg.sender].sub(_value));
      require(rules.doTransfer(_from, _to, _value), 'Transfer failed');
    } else {
      _approve(_from, msg.sender, allowances[_from][msg.sender].sub(_value));
      _transfer(_from, _to, _value);
    }

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

  // Privates
  /**
   * @dev Internal transfer token to specified address. Caller needs to provide authorization
   * signature obtained from MAP API, signed by authority accepted by token issuer.
   * Emits Transfer event.
   *
   * @param _from The address to transfer from.
   * @param _to The address to send tokens to.
   * @param _value The amount of tokens to send.
   * @param _nonce Token transfer nonce, can not repeat nance for subsequent
   * token transfers.
   * @param _expirationTime Timestamp until transfer request is valid.
   * @param _hash Hash of transfer params (kyaHash, from, to, value, nonce, expirationTime).
   * @param _signature Ethereum ECDSA signature of msgHash signed by one of authorities.
   * @return true on success.
   */
  function _transferToken(
    address _from,
    address _to,
    uint256 _value,
    uint256 _nonce,
    uint256 _expirationTime,
    bytes32 _hash,
    bytes memory _signature
  ) internal returns (bool) {
    if (address(restrictions) != address(0)) {
      require(restrictions.authorize(_from, _to, _value), 'transferToken restrictions failed');
    }

    require(now <= _expirationTime, 'transferToken params expired');
    require(_nonce == nonce[_from], 'transferToken params wrong nonce');

    bytes32 kyaHash = assetRegistry.getKyaHash(address(this));

    require(
      keccak256(abi.encodePacked(kyaHash, _from, _to, _value, _nonce, _expirationTime)) == _hash,
      'transferToken params bad hash'
    );
    require(
      roles.isAuthority(_hash.toEthSignedMessageHash().recover(_signature)),
      'transferToken params not authority'
    );

    require(features.checkTransfer(_from, _to), 'Feature transfer check');
    _transfer(_from, _to, _value);

    return true;
  }

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

    nonce[_from]++;

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
      // todo: if owner===sender, do we care about allowance?
      // todo: or more generally. If this can only be done by delegates, why allowance?
      // todo: owner wants to limit how much the delegate can bulk transfer? I guess
      if (owner() != msg.sender) {
        _approve(owner(), msg.sender, allowances[owner()][msg.sender].sub(value));
      }
      _transfer(owner(), to, value);
    }

    return true;
  }

  /**
   * Perform multiple token transfers from the token owner's address.
   * The tokens should already be minted. If this function is to be called by
   * an actor other than the owner (a delegate), the owner has to call approve()
   * first to set up the delegate's allowance.
   *
   * Data needs to be packed correctly before calling this function.
   *
   * @param _lotSize number of tokens in the lot
   * @param _transfers an array or encoded transfers to perform
   * @return true on success
   */
  function encodedBulkTransfer(uint160 _lotSize, uint256[] calldata _transfers)
    external
    onlyDelegate
    returns (bool)
  {
    uint256 count = _transfers.length;
    for (uint256 i = 0; i < count; i++) {
      uint256 tr = _transfers[i];
      uint256 value = (tr >> 160) * _lotSize;
      address to = address(tr & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
      _approve(owner(), msg.sender, allowances[owner()][msg.sender].sub(value));
      _transfer(owner(), to, value);
    }

    return true;
  }

  function setFundraiser() external returns (bool) {
    require(Fundraiser(msg.sender).token() == address(this), 'Can only call for own token');
    fundraiser = msg.sender;
    emit FundraiserAdded(msg.sender);
    return true;
  }
}
