// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

contract PausableFeature {
  bool public paused;

  event Paused(address account);
  event Unpaused(address account);

  modifier whenNotPaused() {
    require(!paused, 'Pausable: paused');
    _;
  }

  modifier whenPaused() {
    require(paused, 'Pausable: not paused');
    _;
  }

  constructor() {
    paused = false;
  }

  function _pause() internal whenNotPaused {
    paused = true;
    emit Paused(msg.sender);
  }

  function _unpause() internal whenPaused {
    paused = false;
    emit Unpaused(msg.sender);
  }
}
