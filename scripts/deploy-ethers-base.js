require('dotenv').config({path: '.env'});
const { deployBaseContracts, getAccounts, dumpContractAddresses } = require('./ethers-helpers');


async function main() {
    const { addresses } = await getAccounts();
    const [swarmAccount, issuerAccount] = addresses;
    const swmSupply = ethers.utils.parseUnits('1000000000');
    const swmPrice = [1, 2]; // 0.5 USD in the format for the Oracle constructor
    const stablecoinParams = ['USDC', 'USDC', 18, ethers.utils.parseUnits('1000000000')];
    const baseContracts = await deployBaseContracts({ swmSupply, swarmAccount, issuerAccount, swmPrice, stablecoinParams });

    console.log('----------------------');
    console.log("Prerequisites deployed");
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
