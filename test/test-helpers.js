const ethers = require('ethers');
const bre = require('hardhat');
const REGEX_ADDR = /0x[a-z0-9]{40}/i;

function getRandomAddress() {
  const chars = '012345679abcdef';
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return ethers.utils.getAddress(result);
}

function getRandomAddresses(count) {
  let result = [];
  for (let i = 0; i < count; i++) result.push(getRandomAddress());
  return result;
}

async function advanceTimeAndBlock(time) {
  const provider = bre.ethers.provider;
  let block = await provider.getBlock('latest');
  return provider.send('evm_mine', [block['timestamp'] + time]);
}

async function takeSnapshot() {
  const provider = bre.ethers.provider;
  return await provider.send('evm_snapshot');
}

async function revertToSnapshot(id) {
  const provider = bre.ethers.provider;
  return await provider.send('evm_revert', [id]);
}

module.exports = {
  REGEX_ADDR,
  getRandomAddress,
  getRandomAddresses,
  advanceTimeAndBlock,
  takeSnapshot,
  revertToSnapshot,
};
