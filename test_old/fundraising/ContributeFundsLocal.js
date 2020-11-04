const {expect} = require('chai');
const timeMachine = require('ganache-time-traveler');
const fs = require('fs');
const moment = require('moment');
const provider = ethers.getDefaultProvider('kovan');
const mnemonic = fs.readFileSync('.private').toString().trim();
const {deployContracts} = require('../helpers/deployer');

let Owner;
let Issuer;
let Contributor;
let WhitelistManager;

(async () => {
  const accounts = await ethers.getSigners();
  Owner = accounts[0];
  Issuer = accounts[1];
  Contributor = accounts[2];
  WhitelistManager = accounts[3];
})();

describe('SwarmPoweredFundraise', async () => {
  before(async () => {
    await deployContracts(this);
  });

  it('should setUp the fundraising contract ', async () => {
    const tokenPrice = ethers.BigNumber.from('1000000');
    const contributionsLocked = false;

    await this.swarmPoweredFundraise.setupContract(
      this.usdc.address,
      tokenPrice,
      this.affiliateManager.address,
      this.contributorRestrictions.address,
      this.getRateMinter.address,
      contributionsLocked
    );

    expect(await this.swarmPoweredFundraise.setupCompleted()).to.equal(true);
  });

  it('Should have initiated all properties', async () => {});
});
