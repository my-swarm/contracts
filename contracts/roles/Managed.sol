pragma solidity ^0.5.0;

/**
 * @dev Manager is responsible for minting and burning tokens in
 * response to SWM token staking changes.
 */
contract Managed {
  address public manager;

  event ManagementTransferred(address indexed previousManager, address indexed newManager);

  /**
   * @dev The Managed constructor sets the original `manager` of the contract to the sender
   * account.
   */
  constructor(address _manager) internal {
    manager = _manager;
    emit ManagementTransferred(address(0), manager);
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyManager() {
    require(_isManager(msg.sender), 'Caller not manager');
    _;
  }

  /**
   * @return true if `msg.sender` is the owner of the contract.
   */
  function _isManager(address _account) internal view returns (bool) {
    return _account == manager;
  }

  /**
   * @dev Allows the current manager to relinquish control of the contract.
   * It will not be possible to call the functions with the `onlyManager`
   * modifier anymore.
   * @notice Renouncing management will leave the contract without an manager,
   * thereby removing any functionality that is only available to the manager.
   */
  function _renounceManagement() internal returns (bool) {
    emit ManagementTransferred(manager, address(0));
    manager = address(0);

    return true;
  }

  /**
   * @dev Allows the current manager to transfer control of the contract to a newManager.
   * @param _newManager The address to transfer management to.
   */
  function _transferManagement(address _newManager) internal returns (bool) {
    require(_newManager != address(0));

    emit ManagementTransferred(manager, _newManager);
    manager = _newManager;

    return true;
  }
}
