require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
// 3-rd party plugins
require('hardhat-contract-sizer');

const fs = require('fs');
const mnemonic = fs.readFileSync('.private').toString().trim();
// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task('accounts', 'Prints the list of accounts', async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

const { ETHERSCAN_API_KEY, INFURA_KEY } = process.env;

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more

const accounts = {
  mnemonic: mnemonic,
  path: "m/44'/60'/0'/0",
};

const gasAuto = {
  gas: 'auto',
  gasPrice: 'auto',
};

const gasLow = {
  gas: 'auto',
  gasPrice: 1,
};

module.exports = {
  etherscan: {
    // The url for the Etherscan API you want to use.
    // For example, here we're using the one for the Ropsten test network
    url: 'https://api-ropsten.etherscan.io/api',
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
    },
    feeCollector: {
      default: 1, // here this will by default take the second account as feeCollector (so in the test this will be a different account than the deployer)
    },
  },
  mocha: {
    timeout: 50000,
  },
  // This is a sample solc configuration that specifies which version of solc to use

  solidity: {
    version: '0.7.6',
    optimizer: {
      enabled: true,
      runs: 100,
    },
  },
  networks: {
    kovan: {
      url: 'https://kovan.infura.io/v3/13749734f374422692b1699e51b0877f',
      chainId: 42,
      ...gasAuto,
      accounts,
    },
    hardhat: {
      gas: 12000000,
      blockGasLimit: 12000000,
      // allowUnlimitedContractSize: true,
    },
    fork: {
      url: 'https://mainnet.infura.io/v3/4aaace1ae3d8484f81138b24012ae2d2',
      chainId: 1,
      ...gasAuto,
    },
  },
};
