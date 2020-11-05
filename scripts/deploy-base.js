require('dotenv').config({ path: '.env' });
const { deployBaseContracts, getAddresses, dumpContractAddresses } = require('./deploy-helpers');

async function main() {
  const [swarmAccount, issuerAccount] = await getAddresses();
  const [baseContracts] = await deployBaseContracts();

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
