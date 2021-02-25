// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.7.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';

import '../minters/TokenMinter.sol';
import '../factories/SRC20Registry.sol';
import '../rules/TransferRules.sol';
import './features/Features.sol';

/**
 * @title SRC20 contract
 * @dev Base SRC20 contract.
 */
contract SRC20 is ERC20, Ownable {
  using SafeMath for uint256;
  using ECDSA for bytes32;

  bytes32 public kyaCid;

  uint256 public nav;
  uint256 public maxTotalSupply;

  address public registry;

  TransferRules public transferRules;
  Features public features;

  modifier onlyMinter() {
    require(msg.sender == getMinter(), 'SRC20: Minter is not the caller');
    _;
  }

  modifier enabled(uint8 feature) {
    require(features.isEnabled(feature), 'SRC20: Token feature is not enabled');
    _;
  }

  event TransferRulesUpdated(address transferRrules);
  event KyaUpdated(address indexed src20, bytes32 kyaCid);
  event NavUpdated(address indexed src20, uint256 nav);

  // Constructors
  // note: owner is passed explicitly from the factory, that's why not msg.sender
  constructor(
    address _owner,
    string memory _name,
    string memory _symbol,
    uint256 _maxTotalSupply,
    uint8 _features,
    address _registry
  ) public ERC20(_name, _symbol) {
    maxTotalSupply = _maxTotalSupply;

    features = new Features(_owner, _features);

    if (features.isEnabled(features.TransferRules())) {
      transferRules = new TransferRules(_owner);
    }

    transferOwnership(_owner);

    registry = _registry;
  }

  /**
   * Change the transfer rules contract. Only owner can call this role
   *
   * @param _transferRules address implementing on-chain restriction checks
   * @return true on success.
   */
  function updateTransferRules(address _transferRules) external onlyOwner returns (bool) {
    return _updateTransferRules(_transferRules);
  }

  function updateKya(bytes32 _kyaCid) external onlyOwner returns (bool) {
    kyaCid = _kyaCid;
    emit KyaUpdated(address(this), _kyaCid);
    return true;
  }

  function updateNav(uint256 _nav) external onlyOwner returns (bool) {
    nav = _nav;
    emit NavUpdated(address(this), _nav);
    return true;
  }

  function getMinter() public view returns (address minter) {
    (minter, ) = SRC20Registry(registry).registry(address(this));
  }

  function transfer(address recipient, uint256 amount) public override returns (bool) {
    require(
      features.checkTransfer(msg.sender, recipient),
      'SRC20: Cannot transfer due to disabled feature'
    );

    if (transferRules != TransferRules(0)) {
      require(transferRules.doTransfer(msg.sender, recipient, amount), 'SRC20: Transfer failed');
    } else {
      _transfer(msg.sender, recipient, amount);
    }

    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public override returns (bool) {
    require(features.checkTransfer(sender, recipient), 'SRC20: Feature transfer check');

    _approve(sender, msg.sender, allowance(sender, msg.sender).sub(amount));
    if (transferRules != ITransferRules(0)) {
      require(transferRules.doTransfer(sender, recipient, amount), 'SRC20: Transfer failed');
    } else {
      _transfer(sender, recipient, amount);
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
   * @param sender The address which you want to send tokens from.
   * @param recipient The address to send tokens to.
   * @param amount The amount of tokens to send.
   * @return true on success.
   */
  function forceTransfer(
    address sender,
    address recipient,
    uint256 amount
  ) external enabled(features.ForceTransfer()) onlyOwner returns (bool) {
    _transfer(sender, recipient, amount);
    return true;
  }

  /**
   * @dev This method is intended to be executed by TransferRules contract when doTransfer is called in transfer
   * and transferFrom methods to check where funds should go.
   *
   * @param sender The address to transfer from.
   * @param recipient The address to send tokens to.
   * @param amount The amount of tokens to send.
   */
  function executeTransfer(
    address sender,
    address recipient,
    uint256 amount
  ) external onlyOwner returns (bool) {
    _transfer(sender, recipient, amount);
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
    onlyOwner
    returns (bool)
  {
    require(_addresses.length == _amounts.length, 'SRC20: Input dataset length mismatch');

    uint256 count = _addresses.length;
    for (uint256 i = 0; i < count; i++) {
      address to = _addresses[i];
      uint256 value = _amounts[i];
      if (owner() != msg.sender) {
        _approve(owner(), msg.sender, allowance(owner(), msg.sender).sub(value));
      }
      _transfer(owner(), to, value);
    }

    return true;
  }

  function burnAccount(address account, uint256 amount)
    external
    enabled(features.AccountBurning())
    onlyOwner
    returns (bool)
  {
    _burn(account, amount);
    return true;
  }

  function burn(address account, uint256 amount) external onlyOwner returns (bool) {
    _burn(account, amount);
    return true;
  }

  function mint(uint256 amount) external onlyOwner returns (bool) {
    require(amount != 0, 'SRC20: Mint amount must be greater than zero');
    TokenMinter(getMinter()).mint(address(this), msg.sender, amount);

    return true;
  }

  function executeMint(address recipient, uint256 amount) external onlyMinter returns (bool) {
    uint256 newSupply = totalSupply().add(amount);

    require(
      newSupply <= maxTotalSupply || maxTotalSupply == 0,
      'SRC20: Mint amount exceeds maximum supply'
    );

    _mint(recipient, amount);
    return true;
  }

  function _updateTransferRules(address _transferRules) internal returns (bool) {
    transferRules = TransferRules(_transferRules);
    if (_transferRules != address(0)) {
      require(transferRules.setSRC(address(this)), 'SRC20 contract already set in transfer rules');
    }

    emit TransferRulesUpdated(_transferRules);

    return true;
  }
}
