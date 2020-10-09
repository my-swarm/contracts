pragma solidity ^0.5.0;

import '../interfaces/ITransferRules.sol';
import '../interfaces/ISRC20.sol';
import '@openzeppelin/contracts/ownership/Ownable.sol';

/*
 * @title ManualApproval contract
 * @dev On-chain transfer rule that is handling transfer request/execution for
 * grey-listed account
 */
contract ManualApproval is Ownable {
  struct TransferRequest {
    address from;
    address to;
    uint256 value;
  }

  uint256 public requestCounter = 1;
  ISRC20 public src20;

  mapping(uint256 => TransferRequest) public transferRequests;
  mapping(address => bool) public greylist;

  event AccountGreylisted(address account, address sender);
  event AccountUnGreylisted(address account, address sender);
  event TransferRequested(uint256 indexed requestId, address from, address to, uint256 value);

  event TransferApproved(
    uint256 indexed requestId,
    address indexed from,
    address indexed to,
    uint256 value
  );

  event TransferDenied(
    uint256 indexed requestId,
    address indexed from,
    address indexed to,
    uint256 value
  );

  constructor() public {}

  /**
   * @dev Owner of this contract have authority to approve tx which are valid.
   *
   * @param _requestId - transfer request number.
   */
  function approveTransfer(uint256 _requestId) external onlyOwner returns (bool) {
    TransferRequest memory req = transferRequests[_requestId];

    require(src20.executeTransfer(address(this), req.to, req.value), 'SRC20 transfer failed');

    delete transferRequests[_requestId];
    emit TransferApproved(_requestId, req.from, req.to, req.value);
    return true;
  }

  /**
   * @dev Deny (delete) the transfer request.
   *
   * @param _requestId - transfer request number.
   */
  function denyTransfer(uint256 _requestId) external returns (bool) {
    TransferRequest memory req = transferRequests[_requestId];
    // todo: it didn't have the isOwner() part.
    //    imo issuer should be the one to deny/cancel the request primaryly no?
    //    fair enough, the 'from' guy can cancel too
    require(isOwner() || req.from == msg.sender, 'Not owner of the transfer request');

    require(
      src20.executeTransfer(address(this), req.from, req.value),
      'SRC20: External transfer failed'
    );

    delete transferRequests[_requestId];
    emit TransferDenied(_requestId, req.from, req.to, req.value);

    return true;
  }

  // Handling grey listing
  function isGreylisted(address _account) public view returns (bool) {
    return greylist[_account];
  }

  function greylistAccount(address _account) external onlyOwner returns (bool) {
    greylist[_account] = true;
    emit AccountGreylisted(_account, msg.sender);
    return true;
  }

  function bulkGreylistAccount(address[] calldata _accounts) external onlyOwner returns (bool) {
    for (uint256 i = 0; i < _accounts.length; i++) {
      address account = _accounts[i];
      greylist[account] = true;
      emit AccountGreylisted(account, msg.sender);
    }
    return true;
  }

  function unGreylistAccount(address _account) external onlyOwner returns (bool) {
    delete greylist[_account];
    emit AccountUnGreylisted(_account, msg.sender);
    return true;
  }

  function bulkUnGreylistAccount(address[] calldata _accounts) external onlyOwner returns (bool) {
    for (uint256 i = 0; i < _accounts.length; i++) {
      address account = _accounts[i];
      delete greylist[account];
      emit AccountUnGreylisted(account, msg.sender);
    }
    return true;
  }

  function _requestTransfer(
    address _from,
    address _to,
    uint256 _value
  ) internal returns (bool) {
    require(src20.executeTransfer(_from, address(this), _value), 'SRC20 transfer failed');

    transferRequests[requestCounter] = TransferRequest(_from, _to, _value);

    emit TransferRequested(requestCounter, _from, _to, _value);
    requestCounter = requestCounter + 1;

    return true;
  }
}
