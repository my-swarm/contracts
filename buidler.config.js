require('dotenv').config();
usePlugin('@nomiclabs/buidler-waffle');
usePlugin('@nomiclabs/buidler-ethers');
usePlugin('@nomiclabs/buidler-etherscan');

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
  solc: {
    version: '0.6.12',
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  networks: {
    fork: {
      url: 'https://localhost:8545',
      chainId: 1,
      gas: 21000000,
      gasPrice: 'auto',
      accounts,
    },
    kovan: {
      url: 'https://kovan.infura.io/v3/13749734f374422692b1699e51b0877f',
      chainId: 42,
      ...gasAuto,
      accounts,
    },
    local: {
      url: 'http://127.0.0.1:7545',
      chainId: 31337,
      ...gasAuto,
    },
  },
};
