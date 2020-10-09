const fs = require('fs');
const path = require('path');
const {exec} = require('child_process');
const jsonFormat = require('json-format');

const jsonConfig = {
  type: 'space',
  size: 2,
};

const CONTRACTS = ['SRC20', 'SRC20Factory', 'SRC20Registry', 'Fundraiser', 'TransferRules'];
const ARTIFACTS_DIR = path.resolve(__dirname, '../artifacts');
const SUBGRAPH_DIR = path.resolve(__dirname, '../../subgraph');
const ISSUANCE_DIR = path.resolve(__dirname, '../../issuance/contracts');

function sendToSubgraph(contractName, abi) {
  fs.writeFileSync(`${SUBGRAPH_DIR}/abis/${contractName}.json`, jsonFormat(abi, jsonConfig));
}

function readAbi(contractName) {
  const artifacts = JSON.parse(fs.readFileSync(`${ARTIFACTS_DIR}/${contractName}.json`).toString());
  return artifacts.abi;
}

console.log('Distributing abis...');

for (const contractName of CONTRACTS) {
  const abi = readAbi(contractName);
  sendToSubgraph(contractName, abi);
  console.log(contractName);
}

console.log('Running codegen remotely...');
exec(`(cd ${SUBGRAPH_DIR} && yarn codegen)`, (error, stdout, stderr) => {
  console.log(stdout);
  console.log(stderr);
});
