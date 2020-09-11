async function getAccounts() {
    const accounts = await ethers.getSigners();
    const addresses = await Promise.all(accounts.map(async (x) => await x.getAddress()));

    return { accounts, addresses };
}

async function deployBaseContracts(options) {
    const swm = await deployContract('SwarmTokenMock', [options.swarmAccount, options.swmSupply]);
    const swmPriceOracle = await deployContract('SWMPriceOracle', options.swmPrice);
    const src20Registry = await deployContract('SRC20Registry', [swm.address]);
    const src20Factory = await deployContract('SRC20Factory', [src20Registry.address]);
    await (await src20Registry.addFactory(src20Factory.address)).wait();
    const assetRegistry = await deployContract('SRC20Factory', [src20Factory.address]);
    const getRateMinter = await deployContract('GetRateMinter', [src20Registry.address, assetRegistry.address, swmPriceOracle.address]);
    await (await src20Registry.addMinter(getRateMinter.address)).wait();
    const setRateMinter = await deployContract('SetRateMinter', [src20Registry.address]);
    const affiliateManager = await deployContract('AffiliateManager');
    const usdc = await deployContract('ERC20Mock', options.stablecoinParams)
    await swm.transfer(options.issuerAccount, options.swmSupply.div(10));

    return {
        swm,
        swmPriceOracle,
        src20Registry,
        src20Factory,
        assetRegistry,
        getRateMinter,
        setRateMinter,
        affiliateManager,
        usdc,
    };
}


async function deployContract(contractName, constructorParams = []) {
    const factory = await ethers.getContractFactory(contractName);
    const contract = await factory.deploy(...constructorParams);
    await contract.deployed();
    return contract;
}

function dumpContractAddresses(contracts) {
    for (const [key, contract] of Object.entries(contracts)) {
        console.log(`${key}: ${contract.address}`);
    }
}

module.exports = {
    getAccounts,
    deployBaseContracts,
    deployContract,
    dumpContractAddresses,
}
