require('dotenv').config({path: '.env'});
const fs = require('fs');
const moment = require('moment');
const provider = ethers.getDefaultProvider('ropsten');
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
  gasLimit: 9000000,
  gasPrice: ethers.utils.parseUnits('9.0', 'gwei'),
};

// New addresses
const swarmTokenMockAddress = '0xF7457cd9d8Fc951d3FF7E3A26A6376690b220d57';
const swmPriceOracleAddress = '0x6a8D2580048B5299ee29266CC6cbC154494F78C4';
const src20RegistryAddress = '0xA547C89E4f5597b5bFeB396CF9601faE5B50a7CB';
const src20FactoryAddress = '0x546E9Fc6582b249d609Ad7Aec100EBb195714AB3';
const assetRegistryAddress = '0x163f819fd94f61907fca84854F7E1e4030890889';
const getRateMinterAddress = '0x63c4693A1C574ea3A40EdC60f0BAe3E18A7F3044';
const setRateMinterAddress = '0x4cf64CA4279fa65F96411dabB5a9B73d3133F31D';

const featuredAddress = '0x4D631Cf62AAEC62f28498729DEF41F8aaA697D13';
const src20RolesAddress = '0x33E5e1D9A2EAEfa6aa787719b04F8B737c4538c2';
const transferRulesAddress = '0x7D780c6c9f6DDCf78aA4ACF4A8A17Bd2737e785c';
const src20TokenAddress = '0x530470cA8134b28596F9D59B86884DA19cC9D29f';

const affiliateManagerAddress = '0x28384f544D1f7AD9bC879DdD04319AEB43EaEAD2';
const swarmPoweredFundraiseAddress = '0x00FDd490430A4E730825C4fD37445563Bd3864b5';
const contributorRestrictionsAddress = '0x01020F551067e46056aaad8345e5b4073D4d3e89';
const usdcAddress = '0xCa5A93FA0812992C0e1B6cf0A63e189dc682F542';

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

   // const SWM = await ethers.getContractFactory('SwarmTokenMock');
   // this.swm = await SWM.deploy(wallet, supply);
   // await this.swm.deployed();
   // console.log("Swarm address is ", this.swm.address);
   this.swm = new ethers.Contract(swarmTokenMockAddress, parseABI('ERC20'), provider);
   this.src20 = new ethers.Contract(src20TokenAddress, parseABI('SRC20'), provider);

   const startDate = moment().unix() + 60; // one minute from the current time
   const endDate = moment().unix() + (60 * 60 * 72); // three days from current time;
   console.log("StartDate: ", startDate, "EndDate: ", endDate);

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
