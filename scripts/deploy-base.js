require('dotenv').config({path: '.env'});
const {deployBaseContracts, getAccounts, dumpContractAddresses} = require('./deploy-helpers');

async function main() {
  const {addresses} = await getAccounts();
  const [swarmAccount, issuerAccount] = addresses;
  const baseContracts = await deployBaseContracts({
    swmSupply: ethers.utils.parseUnits('1000000'), // million
    swarmAccount,
    issuerAccount,
    swmPrice: [1, 2], // 0.5 USD in the format for the Oracle constructor
    stablecoinParams: ['USDC', 'USDC', 18, ethers.utils.parseUnits('1000000000')],
    issuerSwmBalance: ethers.utils.parseUnits('100000'), // 100k
  });

  console.log('----------------------');
  console.log('Prerequisites deployed');
  console.log(`Deployer address: ${swarmAccount}`);
  console.log('');
  dumpContractAddresses(baseContracts);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
