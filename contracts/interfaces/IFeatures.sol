pragma solidity ^0.5.0;

import './IFreezable.sol';
import './IPausable.sol';

/**
 * @dev Support for "SRC20 feature" modifier.
 */
contract IFeatures is IPausable, IFreezable {
  event FeaturesUpdated(
    bool forceTransfer,
    bool tokenFreeze,
    bool accountFreeze,
    bool accountBurn,
    bool transferRules
  );
  event AccountFrozen(address indexed account);
  event AccountUnfrozen(address indexed account);

  uint8 public constant ForceTransfer = 0x01;
  uint8 public constant Pausable = 0x02;
  uint8 public constant AccountBurning = 0x04;
  uint8 public constant AccountFreezing = 0x08;
  uint8 public constant TransferRules = 0x16;

  function _enable(uint8 features) internal;

  function isEnabled(uint8 feature) public view returns (bool);

  function checkTransfer(address from, address to) external view returns (bool);

  function isAccountFrozen(address account) external view returns (bool);

  function freezeAccount(address account) external;

  function unfreezeAccount(address account) external;

  function pauseToken() external;

  function unpauseToken() external;
}
