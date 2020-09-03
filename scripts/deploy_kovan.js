require('dotenv').config({path: '.env'});
const fs = require('fs');
const moment = require('moment');
const provider = ethers.getDefaultProvider('kovan');
const mnemonic = fs.readFileSync('.private').toString().trim();
let Alice = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
let Bob = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1").connect(provider);
let Charlie = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/2").connect(provider);

function parseABI(file) {
  const json = fs.readFileSync('./artifacts/'+file+'.json');
  const obj = JSON.parse(json);
  return obj.abi;
}

let overrides = {
  // The maximum units of gas for the transaction to use
  gasLimit: 8000000,
  gasPrice: ethers.utils.parseUnits('1.0', 'gwei'),
};

// New addresses
// const swarmTokenMockAddress = '0x4E07591915C598bEbE6083C21341e874AF9b8296';
// const swmPriceOracleAddress = '0xF2Cc9891Bf8685C235Caf02cE7bcCe504Ba3F2Eb';
// const src20RegistryAddress = '0x6381EED41817bcaB733F845d3A6EdE64A721dbA1';
// const src20FactoryAddress = '0x6993B667C97610D1816DcAfF67106871Ad588F6f';
// const assetRegistryAddress = '0x4d850bC816040d5C7Bd53740f2CBD0f921222e64';
// const getRateMinterAddress = '0xdEB1F05C668C185f43A2E5fF40950E8aAC828825';
// const setRateMinterAddress = '0xfa4b24Db2849Dc9877b39677293F350b4D1131AC';
//
// const featuredAddress = '0x2d08AC6e6C63b4d4E6807fE9498202DF6945CcaF';
// const src20RolesAddress = '0x71e034871D0de00e0B747A1B0972EA2D770098DF';
// const transferRulesAddress = '0xE930e4D9b0d5F020fBeF4ef474828B5BA0AeB9E2';
// const src20TokenAddress = '0xd8fe55e1a8b6991f839758224d038893b46bb9de';
//
// const affiliateManagerAddress = '0xA13B9d84DBB9927621DBAB1dFa0d2bfd33A81A9a';
// const swarmPoweredFundraiseAddress = '0xb159d0FDaFbf55036026c116d54ac210Da9e5502';
// const contributorRestrictionsAddress = '0x4c997184B911Ca1E592ebd8b491471Cfb86c8ea1';
// const usdcAddress = '0x45f6ebD6332Be48704fd3BeeDC0238652aDf68ac';

async function approveAll(contribute, reserve) {
  let approval = ethers.utils.parseEther('1000000000');
  await reserve.approve(contribute.address, approval);
  await reserve.connect(Bob).approve(contribute.address, approval);
  let tx = await reserve.connect(Charlie).approve(contribute.address, approval);
  await tx.wait(1);
}

function generateVerify(address, args) {

  let cmd = "npx buidler verify --network kovan " + address + args;
}

async function setup() {

  const wallet = await Alice.getAddress();
  const supply = ethers.utils.parseUnits('1000000000');

  // const SWM = await ethers.getContractFactory('SwarmTokenMock');
  // this.swm = await SWM.deploy(wallet, supply);
  // await this.swm.deployed();
  // console.log("Swarm address is ", this.swm.address);
  //
  // const SWMPriceOracle = await ethers.getContractFactory('SWMPriceOracle');
  // this.swmPriceOracle = await SWMPriceOracle.deploy(100, 100);
  // await this.swmPriceOracle.deployed();
  // console.log("Address is ", this.swmPriceOracle.address);
  //
  // const SRC20Registry = await ethers.getContractFactory('SRC20Registry');
  // this.src20Registry = await SRC20Registry.deploy(this.swm.address);
  // await this.src20Registry.deployed();
  // console.log("src20Registry address is ", this.src20Registry.address);
  //
  // const SRC20Factory = await ethers.getContractFactory('SRC20Factory');
  // this.src20Factory = await SRC20Factory.deploy(this.src20Registry.address);
  // await this.src20Factory.deployed();
  // console.log("src20Factory address is ", this.src20Factory.address);
  //
  // const AssetRegistry = await ethers.getContractFactory('AssetRegistry');
  // this.assetRegistry = await AssetRegistry.deploy(this.src20Factory.address);
  // await this.assetRegistry.deployed();
  // console.log("assetRegistry address is ", this.assetRegistry.address);
  //
  // const GetRateMinter = await ethers.getContractFactory('GetRateMinter');
  // this.getRateMinter = await GetRateMinter.deploy(this.src20Registry.address, this.assetRegistry.address, this.swmPriceOracle.address);
  // await this.getRateMinter.deployed();
  // console.log("getRateMinter address is ", this.getRateMinter.address);
  //
  // await this.src20Registry.addMinter(this.getRateMinter.address);
  //
  // const SetRateMinter = await ethers.getContractFactory('SetRateMinter');
  // this.setRateMinter = await SetRateMinter.deploy(this.src20Registry.address);
  // await this.setRateMinter.deployed();
  // console.log("setRateMinter address is ", this.setRateMinter.address);
  //
  // const Featured = await ethers.getContractFactory('Featured');
  // this.featured = await Featured.deploy(wallet, '0x0000000000000000000000000000000000000000');
  // await this.featured.deployed();
  // console.log("featured address is ", this.featured.address);
  //
  // const SRC20Roles = await ethers.getContractFactory('SRC20Roles');
  // this.src20Roles = await SRC20Roles.deploy(wallet ,this.src20Registry.address , '0x0000000000000000000000000000000000000000');
  // await this.src20Roles.deployed();
  // console.log("src20Roles address is ", this.src20Roles.address);
  //
  // const TransferRules = await ethers.getContractFactory('TransferRules');
  // this.transferRules = await TransferRules.deploy(wallet);
  // await this.transferRules.deployed();
  // console.log("transferRules address is ", this.transferRules.address);
  //
  // await this.src20Registry.addFactory(this.src20Factory.address);
  //
  // let filter = this.src20Factory.filters.SRC20Created(null);
  //
  // await this.src20Factory.create(
  //   'Security Token',
  //   'SCT',
  //   18,
  //   ethers.utils.parseUnits('0'),
  //   '0x06de0416e5c5bdd5ec957d2b178cd25019821b53932af0ae6445c225ecb0f6b8',
  //   'https://www.swarm.fund',
  //   0,
  //   [
  //       wallet,
  //       this.transferRules.address,
  //       this.transferRules.address,
  //       this.src20Roles.address,
  //       this.featured.address,
  //       this.assetRegistry.address,
  //       this.getRateMinter.address
  //   ],
  //   overrides
  // );
  //
  // this.src20TokenAddress = filter.address;
  // console.log("src20TokenAddress is: ", this.src20TokenAddress);
  //

  this.src20TokenAddress = "0xd8fe55e1a8b6991f839758224d038893b46bb9de";

  const AffiliateManager = await ethers.getContractFactory('AffiliateManager');
  this.affiliateManager = await AffiliateManager.deploy();
  await this.affiliateManager.deployed();
  console.log("affiliateManager address is ", this.affiliateManager.address);

  const startDate = moment().unix() + 60; // 1 minute from the current time
  const endDate = moment().unix() + (60 * 60 * 72); // three days from current time;

  console.log("sDate: ", startDate);
  console.log("eDate: ", endDate);

  const SwarmPoweredFundraise = await ethers.getContractFactory('SwarmPoweredFundraise');
  this.swarmPoweredFundraise = await SwarmPoweredFundraise.deploy(
    "Fundraise",
    this.src20TokenAddress,
    ethers.utils.parseUnits('1000000'),
    startDate,
    endDate,
    ethers.utils.parseUnits('100000'),
    ethers.utils.parseUnits('1000000'),
    overrides
  );
  await this.swarmPoweredFundraise.deployed();
  console.log("swarmPoweredFundraise address is ", this.swarmPoweredFundraise.address);

  const ContributorRestrictions = await ethers.getContractFactory('ContributorRestrictions');
  this.contributorRestrictions = await ContributorRestrictions.deploy(
    this.swarmPoweredFundraise.address,
    0,
    0,
    0,
    overrides
  );
  await this.contributorRestrictions.deployed();
  console.log("contributorRestrictions address is ", this.contributorRestrictions.address);

  const USDC = await ethers.getContractFactory('ERC20Mock');
  this.usdc = await USDC.deploy(
    "USDC",
    "USDC",
    18,
    ethers.utils.parseUnits('100000000'),
    overrides
  );
  await this.usdc.deployed();
  console.log("USDC address is ", this.usdc.address);

  await this.swarmPoweredFundraise.setupContract(
    this.usdc.address,
    ethers.utils.parseUnits('1'),
    this.affiliateManager.address,
    this.contributorRestrictions.address,
    "0xdEB1F05C668C185f43A2E5fF40950E8aAC828825",//this.getRateMinter.address,
    true,
    overrides
  )
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
