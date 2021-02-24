// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.7.0;

import '@openzeppelin/contracts/access/Ownable.sol';

import './Pausable.sol';
import './Freezable.sol';

/**
 * @dev Support for "SRC20 feature" modifier.
 */
contract Features is Pausable, Freezable, Ownable {
  uint8 public features;
  uint8 public constant ForceTransfer = 0x01;
  uint8 public constant Pausable = 0x02;
  uint8 public constant AccountBurning = 0x04;
  uint8 public constant AccountFreezing = 0x08;
  uint8 public constant TransferRules = 0x16;

  modifier enabled(uint8 feature) {
    require(isEnabled(feature), 'Features: Token feature is not enabled');
    _;
  }

  event FeaturesUpdated(
    bool forceTransfer,
    bool tokenFreeze,
    bool accountFreeze,
    bool accountBurn,
    bool transferRules
  );

  constructor(address _owner, uint8 _features) public {
    _enable(_features);
    transferOwnership(_owner);
  }

  /**
   * @dev Enable features. Call from SRC20 token constructor.
   * @param _features ORed features to enable.
   */
  function _enable(uint8 _features) internal {
    features = _features;
    emit FeaturesUpdated(
      _features & ForceTransfer != 0,
      _features & Pausable != 0,
      _features & AccountBurning != 0,
      _features & AccountFreezing != 0,
      _features & TransferRules != 0
    );
  }

  /**
   * @dev Returns if feature is enabled.
   * @param _feature Feature constant to check if enabled.
   * @return True if feature is enabled.
   */
  function isEnabled(uint8 _feature) public view returns (bool) {
    return features & _feature != 0;
  }

  /**
   * @dev Call to check if transfer will pass from feature contract stand point.
   *
   * @param _from The address to transfer from.
   * @param _to The address to send tokens to.
   *
   * @return True if the transfer is allowed
   */
  function checkTransfer(address _from, address _to) external view returns (bool) {
    return !_isAccountFrozen(_from) && !_isAccountFrozen(_to) && !paused;
  }

  /**
   * @dev Check if specified account is frozen. Token issuer can
   * freeze any account at any time and stop accounts making
   * transfers.
   *
   * @return True if account is frozen.
   */
  function isAccountFrozen(address _account) external view returns (bool) {
    return _isAccountFrozen(_account);
  }

  /**
   * @dev Freezes account.
   * Emits AccountFrozen event.
   */
  function freezeAccount(address _account) external enabled(AccountFreezing) onlyOwner {
    _freezeAccount(_account);
  }

  /**
   * @dev Unfreezes account.
   * Emits AccountUnfrozen event.
   */
  function unfreezeAccount(address _account) external enabled(AccountFreezing) onlyOwner {
    _unfreezeAccount(_account);
  }

  /**
   * @dev Pauses token.
   */
  function pauseToken() external enabled(Pausable) onlyOwner {
    _pause();
  }

  /**
   * @dev Unpause token.
   */
  function unpauseToken() external enabled(Pausable) onlyOwner {
    _unpause();
  }
}
