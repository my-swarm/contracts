require('dotenv').config({path: '.env'});
const fs = require('fs');
const moment = require('moment');
const ethers = require('ethers');
const provider = ethers.getDefaultProvider('kovan');
const mnemonic = fs.readFileSync('.private').toString().trim();

// alice is a Swarm entity that deploys required contracts
let Alice = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
let Bob = ethers.Wallet.fromMnemonic(mnemonic, 'm/44\'/60\'/0\'/0/1').connect(provider);
let Charlie = ethers.Wallet.fromMnemonic(mnemonic, 'm/44\'/60\'/0\'/0/2').connect(provider);

let overrides = {
    // The maximum units of gas for the transaction to use
    gasLimit: 8000000,
    gasPrice: ethers.utils.parseUnits('1.0', 'gwei'),
};

async function approveAll(contribute, reserve) {
    let approval = ethers.utils.parseEther('1000000000');
    await reserve.approve(contribute.address, approval);
    await reserve.connect(Bob).approve(contribute.address, approval);
    let tx = await reserve.connect(Charlie).approve(contribute.address, approval);
    await tx.wait(1);
}

async function main() {


    const { addresses } = await getAccounts();
    const [, issuerAccount, aliceAccount] = addresses;

    const prerequisites = await deployPrerequisites(options);
    console.log("Prerequisites deployed");
    dumpContractAddresses(prerequisites);

    const wallet = await Alice.getAddress();

    console.log('featured address is ', featured.address);
    const src20Roles = await deployContract('SRC20Roles', [wallet, src20Registry.address, '0x0000000000000000000000000000000000000000']);
    console.log('src20Roles address is ', src20Roles.address);
    const transferRules = await deployContract('TransferRules', [wallet]);
    console.log('transferRules address is ', transferRules.address);

    let filter = src20Factory.filters.SRC20Created(null);

    await src20Factory.create(
        'Security Token',
        'SCT',
        18,
        ethers.utils.parseUnits('100000000'),
        '0x06de0416e5c5bdd5ec957d2b178cd25019821b53932af0ae6445c225ecb0f6b8',
        'https://www.swarm.fund',
        0,
        [
            wallet,
            transferRules.address,
            transferRules.address,
            src20Roles.address,
            featured.address,
            assetRegistry.address,
            getRateMinter.address,
        ],
        overrides,
    );

    src20TokenAddress = filter.address;
    console.log('src20TokenAddress is: ', src20TokenAddress);

    const startDate = moment().unix() + 60; // 1 minute from the current time
    const endDate = moment().unix() + (60 * 60 * 72); // three days from current time;

    const SwarmPoweredFundraise = await ethers.getContractFactory('SwarmPoweredFundraise');
    swarmPoweredFundraise = await SwarmPoweredFundraise.deploy(
        'Fundraise',
        src20TokenAddress,
        ethers.utils.parseUnits('1000000'),
        startDate,
        endDate,
        ethers.utils.parseUnits('100000'),
        ethers.utils.parseUnits('1000000'),
        overrides,
    );
    await swarmPoweredFundraise.deployed();
    console.log('swarmPoweredFundraise address is ', swarmPoweredFundraise.address);

    const ContributorRestrictions = await ethers.getContractFactory('ContributorRestrictions');
    contributorRestrictions = await ContributorRestrictions.deploy(
        swarmPoweredFundraise.address,
        0,
        0,
        0,
        overrides,
    );
    await contributorRestrictions.deployed();
    console.log('contributorRestrictions address is ', contributorRestrictions.address);

    const USDC = await ethers.getContractFactory('ERC20Mock');
    usdc = await USDC.deploy(
        'USDC',
        'USDC',
        18,
        ethers.utils.parseUnits('100000000'),
        overrides,
    );
    await usdc.deployed();
    console.log('USDC address is ', usdc.address);

    await swarmPoweredFundraise.setupContract(
        usdc.address,
        ethers.utils.parseUnits('1'),
        affiliateManager.address,
        contributorRestrictions.address,
        getRateMinter.address,
        true,
        overrides,
    );
    // swm = new ethers.Contract(swarmTokenMockAddress, parseABI('ERC20'), provider);
    // src20 = new ethers.Contract(src20TokenAddress, parseABI('SRC20'), provider);
    //
    // const startDate = moment().unix() + 60 * 30; // 30 minutes from the current time
    // const endDate = moment().unix() + (60 * 60 * 72); // three days from current time;
    // console.log("StartDate: ", startDate, "EndDate: ", endDate);

    // const USDC = await ethers.getContractFactory('ERC20Mock');
    // usdc = await USDC.deploy("USDC", "USDC", 6, ethers.BigNumber.from('1000000000000'));
    // await usdc.deployed();
    // console.log(usdc.address);

    // const SwarmPoweredFundraise = await ethers.getContractFactory('SwarmPoweredFundraise');
    // swarmPoweredFundraise = await SwarmPoweredFundraise.deploy(
    //   "Fundraise",
    //   src20TokenAddress,
    //   ethers.utils.parseUnits('1000000'),
    //   startDate,
    //   endDate,
    //   ethers.utils.parseUnits('100000'),
    //   ethers.utils.parseUnits('1000000'),
    //   overrides
    // );
    // await swarmPoweredFundraise.deployed();
    // console.log("SwarmPoweredFundraise address: ", swarmPoweredFundraise.address);
}

async function invest(contribute) {
    value = ethers.utils.parseEther('10');
    await contribute.connect(Alice).invest(value, overrides);
    await contribute.connect(Bob).invest(value, overrides);
    let tx = await contribute.connect(Charlie).invest(value, overrides);
    await tx.wait(1);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
