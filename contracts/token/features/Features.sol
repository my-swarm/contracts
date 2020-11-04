pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import '../../interfaces/IFeatures.sol';
import './Pausable.sol';
import './Freezable.sol';

/**
 * @dev Support for "SRC20 feature" modifier.
 */
contract Features is IFeatures, Pausable, Freezable, Ownable {
  uint8 public features;

  modifier enabled(uint8 feature) {
    require(isEnabled(feature), 'Token feature is not enabled');
    _;
  }

  constructor(address _owner, uint8 _features) public {
    _enable(_features);
    _transferOwnership(_owner);
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
      _features & AccountFreezing != 0
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
   * Emits TokenPaused event.
   */
  function freezeToken() external enabled(Pausable) onlyOwner {
    _pause();
  }

  /**
   * @dev Unpause token.
   * Emits TokenUnPaused event.
   */
  function unfreezeToken() external enabled(Pausable) onlyOwner {
    _unpause();
  }
}
