require('dotenv').config({ path: '.env' });
const fs = require('fs');
const moment = require('moment');
const provider = ethers.getDefaultProvider('kovan');
const mnemonic = fs.readFileSync('.private').toString().trim();
let Alice = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
let Bob = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1").connect(provider);
let Charlie = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/2").connect(provider);

function parseABI(file) {
  const json = fs.readFileSync('./artifacts/' + file + '.json');
  const obj = JSON.parse(json);
  return obj.abi;
}

let overrides = {
  // The maximum units of gas for the transaction to use
  gasLimit: 8000000,
  gasPrice: ethers.utils.parseUnits('1.0', 'gwei'),
};

// New addresses
// const swarmTokenMockAddress = '0xDa6f5D62Caae82Ec515f22cFd22EF4e3d07a857E';
// const swmPriceOracleAddress = '0xb993A830D03A8e610Ef3C03AB6424e1aD7dEfeB4';
// const src20RegistryAddress = '0xA547C89E4f5597b5bFeB396CF9601faE5B50a7CB';
// const src20FactoryAddress = '0x546E9Fc6582b249d609Ad7Aec100EBb195714AB3';
// const assetRegistryAddress = '0x163f819fd94f61907fca84854F7E1e4030890889';
// const TokenMinterAddress = '0x63c4693A1C574ea3A40EdC60f0BAe3E18A7F3044';
// const MasterMinterAddress = '0x4cf64CA4279fa65F96411dabB5a9B73d3133F31D';
//
// const featuredAddress = '0x4D631Cf62AAEC62f28498729DEF41F8aaA697D13';
// const src20RolesAddress = '0x33E5e1D9A2EAEfa6aa787719b04F8B737c4538c2';
// const transferRulesAddress = '0x7D780c6c9f6DDCf78aA4ACF4A8A17Bd2737e785c';
// const src20TokenAddress = '0x530470cA8134b28596F9D59B86884DA19cC9D29f';
//
// const affiliateManagerAddress = '0x28384f544D1f7AD9bC879DdD04319AEB43EaEAD2';
// const swarmPoweredFundraiseAddress = '0xCADD9E6A01669b78b63D5F8AD70AD592C2a365Fb';
// const contributorRestrictionsAddress = '0x01020F551067e46056aaad8345e5b4073D4d3e89';
// const usdcAddress = '0xCa5A93FA0812992C0e1B6cf0A63e189dc682F542';

async function approveAll(contribute, reserve) {
  let approval = ethers.utils.parseEther('1000000000');
  await reserve.approve(contribute.address, approval);
  await reserve.connect(Bob).approve(contribute.address, approval);
  let tx = await reserve.connect(Charlie).approve(contribute.address, approval);
  await tx.wait(1);
}

async function setup() {
  const wallet = await Alice.getAddress();
  const supply = ethers.utils.parseUnits('1000000000');

  const SWM = await ethers.getContractFactory('SwarmTokenMock');
  this.swm = await SWM.deploy(wallet, supply);
  await this.swm.deployed();
  console.log('Swarm address is ', this.swm.address);

  const SWMPriceOracle = await ethers.getContractFactory('SWMPriceOracle');
  this.swmPriceOracle = await SWMPriceOracle.deploy(100, 100);
  await this.swmPriceOracle.deployed();
  console.log('Address is ', this.swmPriceOracle.address);

  const SRC20Registry = await ethers.getContractFactory('SRC20Registry');
  this.src20Registry = await SRC20Registry.deploy(this.swm.address);
  await this.src20Registry.deployed();
  console.log('src20Registry address is ', this.src20Registry.address);

  const SRC20Factory = await ethers.getContractFactory('SRC20Factory');
  this.src20Factory = await SRC20Factory.deploy(this.src20Registry.address);
  await this.src20Factory.deployed();
  console.log('src20Factory address is ', this.src20Factory.address);

  const AssetRegistry = await ethers.getContractFactory('AssetRegistry');
  this.assetRegistry = await AssetRegistry.deploy(this.src20Factory.address);
  await this.assetRegistry.deployed();
  console.log('assetRegistry address is ', this.assetRegistry.address);

  const TokenMinter = await ethers.getContractFactory('TokenMinter');
  this.TokenMinter = await TokenMinter.deploy(
    this.src20Registry.address,
    this.assetRegistry.address,
    this.swmPriceOracle.address
  );
  await this.TokenMinter.deployed();
  console.log('TokenMinter address is ', this.TokenMinter.address);

  const MasterMinter = await ethers.getContractFactory('MasterMinter');
  this.MasterMinter = await MasterMinter.deploy(this.src20Registry.address);
  await this.MasterMinter.deployed();
  console.log('MasterMinter address is ', this.MasterMinter.address);

  const Featured = await ethers.getContractFactory('Featured');
  this.featured = await Featured.deploy(wallet, '0x0000000000000000000000000000000000000000');
  await this.featured.deployed();
  console.log('featured address is ', this.featured.address);

  const SRC20Roles = await ethers.getContractFactory('SRC20Roles');
  this.src20Roles = await SRC20Roles.deploy(
    wallet,
    this.src20Registry.address,
    '0x0000000000000000000000000000000000000000'
  );
  await this.src20Roles.deployed();
  console.log('src20Roles address is ', this.src20Roles.address);

  const TransferRules = await ethers.getContractFactory('TransferRules');
  this.transferRules = await TransferRules.deploy(wallet);
  await this.transferRules.deployed();
  console.log('transferRules address is ', this.transferRules.address);

  let filter = this.src20Factory.filters.SRC20Created(null);

  await this.src20Factory.create(
    'Security Token',
    'SCT',
    18,
    ethers.utils.parseUnits('100000000'),
    '0x06de0416e5c5bdd5ec957d2b178cd25019821b53932af0ae6445c225ecb0f6b8',
    'https://www.swarm.fund',
    0,
    [
      wallet,
      this.transferRules.address,
      this.transferRules.address,
      this.src20Roles.address,
      this.featured.address,
      this.assetRegistry.address,
      this.TokenMinter.address,
    ],
    overrides
  );

  this.src20TokenAddress = filter.address;
  console.log('src20TokenAddress is: ', this.src20TokenAddress);

  const AffiliateManager = await ethers.getContractFactory('AffiliateManager');
  this.affiliateManager = await AffiliateManager.deploy();
  await this.affiliateManager.deployed();
  console.log('affiliateManager address is ', this.affiliateManager.address);

  const startDate = moment().unix() + 60; // 1 minute from the current time
  const endDate = moment().unix() + 60 * 60 * 72; // three days from current time;

  const SwarmPoweredFundraise = await ethers.getContractFactory('SwarmPoweredFundraise');
  this.swarmPoweredFundraise = await SwarmPoweredFundraise.deploy(
    'Fundraise',
    this.src20TokenAddress,
    ethers.utils.parseUnits('1000000'),
    startDate,
    endDate,
    ethers.utils.parseUnits('100000'),
    ethers.utils.parseUnits('1000000'),
    overrides
  );
  await this.swarmPoweredFundraise.deployed();
  console.log('swarmPoweredFundraise address is ', this.swarmPoweredFundraise.address);

  const ContributorRestrictions = await ethers.getContractFactory('ContributorRestrictions');
  this.contributorRestrictions = await ContributorRestrictions.deploy(
    this.swarmPoweredFundraise.address,
    0,
    0,
    0,
    overrides
  );
  await this.contributorRestrictions.deployed();
  console.log('contributorRestrictions address is ', this.contributorRestrictions.address);

  const USDC = await ethers.getContractFactory('ERC20Mock');
  this.usdc = await USDC.deploy(
    'USDC',
    'USDC',
    18,
    ethers.utils.parseUnits('100000000'),
    overrides
  );
  await this.usdc.deployed();
  console.log('USDC address is ', this.usdc.address);

  await this.swarmPoweredFundraise.setupContract(
    this.usdc.address,
    ethers.utils.parseUnits('1'),
    this.affiliateManager.address,
    this.contributorRestrictions.address,
    this.TokenMinter.address,
    true,
    overrides
  );
  // this.swm = new ethers.Contract(swarmTokenMockAddress, parseABI('ERC20'), provider);
  // this.src20 = new ethers.Contract(src20TokenAddress, parseABI('SRC20'), provider);
  //
  // const startDate = moment().unix() + 60 * 30; // 30 minutes from the current time
  // const endDate = moment().unix() + (60 * 60 * 72); // three days from current time;
  // console.log("StartDate: ", startDate, "EndDate: ", endDate);

  // const USDC = await ethers.getContractFactory('ERC20Mock');
  // this.usdc = await USDC.deploy("USDC", "USDC", 6, ethers.BigNumber.from('1000000000000'));
  // await this.usdc.deployed();
  // console.log(this.usdc.address);

  // const SwarmPoweredFundraise = await ethers.getContractFactory('SwarmPoweredFundraise');
  // this.swarmPoweredFundraise = await SwarmPoweredFundraise.deploy(
  //   "Fundraise",
  //   src20TokenAddress,
  //   ethers.utils.parseUnits('1000000'),
  //   startDate,
  //   endDate,
  //   ethers.utils.parseUnits('100000'),
  //   ethers.utils.parseUnits('1000000'),
  //   overrides
  // );
  // await this.swarmPoweredFundraise.deployed();
  // console.log("SwarmPoweredFundraise address: ", this.swarmPoweredFundraise.address);
}

async function invest(contribute) {
  this.value = ethers.utils.parseEther('10');
  await contribute.connect(Alice).invest(this.value, overrides);
  await contribute.connect(Bob).invest(this.value, overrides);
  let tx = await contribute.connect(Charlie).invest(this.value, overrides);
  await tx.wait(1);
}

async function main() {
  await setup();
  // const wallet = await Alice.getAddress();
  // const amount = ethers.utils.parseUnits('1000000000');
  //const balance = await this.swm.balanceOf(wallet);
  //console.log(balance.toString());
  // let tx = await this.contribute.finishMintEvent();
  // await tx.wait(1);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
