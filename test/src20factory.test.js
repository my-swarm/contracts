const { expect } = require('chai');
const {
  getIssuer,
  deployBaseContracts,
  getSrc20Options,
  createSrc20,
  getEvent,
} = require('../scripts/deploy-helpers');

const { REGEX_ADDR } = require('./test-helpers');

describe('SRC20Factory creates tokens', async () => {
  let baseContracts;
  let options;
  let issuer;
  let event;
  let tokenAddress;

  before(async () => {
    baseContracts = (await deployBaseContracts())[0];
    issuer = await getIssuer();

    options = getSrc20Options({ features: 31 });
    const transaction = await createSrc20(baseContracts, issuer, options);
    event = await getEvent(transaction, 'SRC20Created');
    tokenAddress = event.token;
  });

  it('Throws event', async () => {
    expect(event.owner).to.equal(issuer.address);
    expect(tokenAddress).to.match(REGEX_ADDR);
    expect(event.name).to.equal(options.name);
    expect(event.symbol).to.equal(options.symbol);
    expect(event.maxTotalSupply.toString()).to.equal(options.maxSupply.toString());
  });

  it('Creates registry record', async () => {
    const { src20Registry, tokenMinter } = baseContracts;

    const registryRecord = await src20Registry.registry(tokenAddress);
    expect(registryRecord.isRegistered).to.equal(true);
    expect(registryRecord.minter).to.equal(tokenMinter.address);
  });

  it('Sets token up', async () => {
    const { src20Factory, tokenMinter } = baseContracts;
    const src20 = await ethers.getContractAt('SRC20', tokenAddress);
    expect(await src20.name()).to.equal(options.name);
    expect(await src20.symbol()).to.equal(options.symbol);
    expect(await src20.decimals()).to.equal(18);
    expect(await src20.kyaUri()).to.equal(options.kyaUri);
    expect((await src20.nav()).toNumber()).to.equal(options.nav);
    expect((await src20.maxTotalSupply()).toString()).to.equal(options.maxSupply.toString());
    expect(await src20.getMinter()).to.equal(tokenMinter.address);
    expect(await src20.getFactory()).to.equal(src20Factory.address);
    expect(await src20.transferRules()).not.to.be.empty;
    expect(await src20.features()).not.to.be.empty;
    expect(await src20.owner()).to.equal(issuer.address);
  });
});
