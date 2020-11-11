pragma solidity ^0.5.0;

import '@openzeppelin/contracts/ownership/Ownable.sol';
import './ManualApproval.sol';
import './Whitelisted.sol';
import '../interfaces/ISRC20.sol';
import '../interfaces/ITransferRules.sol';
import '../interfaces/ITransferRestrictions.sol';

/*
 * @title TransferRules contract
 * @dev Contract that is checking if on-chain rules for token transfers are concluded.
 * It implements whitelist and grey list.
 */
contract TransferRules is ITransferRules, ManualApproval, Whitelisted {
  modifier onlySRC20 {
    require(msg.sender == address(src20));
    _;
  }

  constructor(address _owner) public {
    _transferOwnership(_owner);
    whitelisted[_owner] = true;
  }

  /**
   * @dev Set for what contract this rules are.
   *
   * @param _src20 - Address of SRC20 contract.
   */
  function setSRC(address _src20) external returns (bool) {
    require(address(src20) == address(0), 'SRC20 already set');
    src20 = ISRC20(_src20);
    return true;
  }

  /**
   * @dev Checks if transfer passes transfer rules.
   *
   * @param _from The address to transfer from.
   * @param _to The address to send tokens to.
   * @param _value The amount of tokens to send.
   */
  function authorize(
    address _from,
    address _to,
    uint256 _value
  ) public view returns (bool) {
    uint256 v;
    v = _value; // eliminate compiler warning
    return
      (isWhitelisted(_from) || isGreylisted(_from)) && (isWhitelisted(_to) || isGreylisted(_to));
  }

  /**
   * @dev Do transfer and checks where funds should go. If both from and to are
   * on the whitelist funds should be transferred but if one of them are on the
   * grey list token-issuer/owner need to approve transfer.
   *
   * @param _from The address to transfer from.
   * @param _to The address to send tokens to.
   * @param _value The amount of tokens to send.
   */
  function doTransfer(
    address _from,
    address _to,
    uint256 _value
  ) external onlySRC20 returns (bool) {
    require(authorize(_from, _to, _value), 'Transfer not authorized');

    if (isGreylisted(_from) || isGreylisted(_to)) {
      _requestTransfer(_from, _to, _value);
      return true;
    }

    require(ISRC20(src20).executeTransfer(_from, _to, _value), 'SRC20 transfer failed');

    return true;
  }
}
