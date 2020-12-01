const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const jsonFormat = require('json-format');

const jsonConfig = {
  type: 'space',
  size: 2,
};

const CONTRACTS = [
  'AssetRegistry',
  'Features',
  'TokenMinter',
  'SRC20Roles',
  'SRC20Factory',
  'SRC20Registry',
  'TransferRules',
  'SWMPriceOracle',
  'SRC20',
  'Fundraiser',
  'ContributorRestrictions',
  'AffiliateManager',
  'FundraiserManager',
];
const ARTIFACTS_DIR = path.resolve(__dirname, '../artifacts');
const SUBGRAPH_DIR = path.resolve(__dirname, '../../subgraph');
const ISSUANCE_DIR = path.resolve(__dirname, '../../issuance/@contracts');

function sendToSubgraph(contractName, abi) {
  fs.writeFileSync(`${SUBGRAPH_DIR}/abis/${contractName}.json`, jsonFormat(abi, jsonConfig));
}

function sendToIssuance(contractName, abi, bytecode) {
  fs.writeFileSync(`${ISSUANCE_DIR}/abis/${contractName}.json`, jsonFormat(abi, jsonConfig));
  const bytecodesPath = `${ISSUANCE_DIR}/bytecodes.json`;
  const bytecodes = JSON.parse(fs.readFileSync(bytecodesPath).toString());
  bytecodes[contractName] = bytecode;
  fs.writeFileSync(bytecodesPath, jsonFormat(bytecodes, jsonConfig));
}

function readArtifacts(contractName) {
  return JSON.parse(fs.readFileSync(`${ARTIFACTS_DIR}/${contractName}.json`).toString());
}

console.log('Distributing abis...');

for (const contractName of CONTRACTS) {
  const artifacts = readArtifacts(contractName);
  const { abi, bytecode } = artifacts;
  sendToSubgraph(contractName, abi);
  sendToIssuance(contractName, abi, bytecode);
  console.log(contractName);
}

console.log('Running codegen remotely...');
exec(`(cd ${SUBGRAPH_DIR} && yarn codegen)`, (error, stdout, stderr) => {
  console.log(stdout);
  console.log(stderr);
});
