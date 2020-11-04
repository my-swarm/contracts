pragma solidity ^0.5.0;

import '../../interfaces/IPausable.sol';

/**
 * @title Pausable token feature
 * @dev Base contract providing implementation for token pausing and
 * checking if token is paused.
 */
contract Pausable is IPausable {
  bool public paused;

  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    require(!paused, 'Pausable: paused');
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    require(paused, 'Pausable: not paused');
    _;
  }

  /**
   * @dev Initializes the contract in unpaused state.
   */
  constructor() internal {
    paused = false;
  }

  /**
   * @dev Sets stopped state.
   */
  function _pause() internal whenNotPaused {
    paused = true;
    emit Paused(msg.sender);
  }

  /**
   * @dev Returns to normal state.
   */
  function _unpause() internal whenPaused {
    paused = false;
    emit Unpaused(msg.sender);
  }
}
