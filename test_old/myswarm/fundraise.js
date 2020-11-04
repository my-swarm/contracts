const {ethers, config} = require('@nomiclabs/buidler');
const {readArtifact} = require('@nomiclabs/buidler/plugins');
require('dotenv').config({path: '.env'});
const moment = require('moment');
const {linkBytecode} = require('../helpers/utils');

const label = 'TestFundraise';
const src20tokenSupply = ethers.utils.parseUnits('1000000');
const investmentAmount = ethers.utils.parseUnits('500');
const startDate = moment().unix(); // current time
const endDate = moment().unix() + 60 * 60 * 72; // three days from current time;
const softCapBCY = ethers.utils.parseUnits('1000000');
const hardCapBCY = ethers.utils.parseUnits('10000000');
const minAmountBCY = ethers.utils.parseUnits('50');
const maxAmountBCY = ethers.utils.parseUnits('1000');
const contributionsLocked = false;

describe('Testing contracts deployment and setup', async () => {
  before(async () => {
    const ercTotalSupply = ethers.utils.parseUnits('100000000');
    const Erc20Token = await ethers.getContractFactory('ERC20Mock');
    root.swm = await Erc20Token.deploy('Swarm', 'SWM', 18, ercTotalSupply);
    await root.swm.deployed();
    root.usdc = await Erc20Token.deploy('USD Coin', 'USDC', 6, ercTotalSupply);
    await root.usdc.deployed();
    root.src20 = await Erc20Token.deploy('Security Token', 'SRC20', 18, ercTotalSupply);
    await root.swm.deployed();
  });

  it('Should retrieve the lendingPoolCore address', async () => {
    expect(await this.lendingPoolAddressesProvider.getLendingPoolCore()).to.equal(
      this.lendingPoolCore.address
    );
  });
});
