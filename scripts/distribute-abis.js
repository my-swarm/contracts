const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const jsonFormat = require('json-format');

const jsonConfig = {
  type: 'space',
  size: 2,
};

const CONTRACTS = [
  'fundraising/Fundraiser',
  'fundraising/ContributorRestrictions',
  'fundraising/AffiliateManager',
  'fundraising/FundraiserManager',
  'minters/TokenMinter',
  'minters/SWMPriceOracle',
  'registry/SRC20Registry',
  'rules/TransferRules',
  'token/SRC20',
  'token/features/Features',
];
const ARTIFACTS_DIR = path.resolve(__dirname, '../artifacts/contracts');
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

function readArtifacts(contractPath) {
  const contractName = contractPath.split('/').pop();
  return JSON.parse(
    fs.readFileSync(`${ARTIFACTS_DIR}/${contractPath}.sol/${contractName}.json`).toString()
  );
}

console.log('Distributing abis...');

for (const contractPath of CONTRACTS) {
  const contractName = contractPath.split('/').pop();
  const artifacts = readArtifacts(contractPath);
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
