const { expect } = require('chai');
const {
  getIssuer,
  deployBaseContracts,
  deployTokenContracts,
  getSrc20Options,
  createSrc20,
  getEvent,
  ZERO_ADDRESS,
} = require('../scripts/deploy-helpers');

const { REGEX_ADDR } = require('./test-helpers');

describe('SRC20Factory creates tokens', async () => {
  let baseContracts;
  let tokenContracts; // except for src20
  let baseContractOptions;
  let tokenContractOptions;
  let issuerAddress;

  function getSrc20Addresses() {
    const { assetRegistry, tokenMinter } = baseContracts;
    const { transferRules, roles, features } = tokenContracts;
    return [
      issuerAddress,
      transferRules.address,
      roles.address,
      features.address,
      assetRegistry.address,
      tokenMinter.address,
    ];
  }

  before(async () => {
    let result;
    result = await deployBaseContracts();
    baseContracts = result[0];
    baseContractOptions = result[1];
    issuerAddress = await (await getIssuer()).getAddress();
    result = await deployTokenContracts(baseContracts, { transferRules: true }, true);
    tokenContracts = result[0];
    tokenContractOptions = result[1];
  });

  it('Token is created with records in src registry and asset registry', async () => {
    const { src20Factory, src20Registry, assetRegistry } = baseContracts;
    const { transferRules, roles, features } = tokenContracts;
    const options = getSrc20Options();
    const addresses = getSrc20Addresses();
    const transaction = await createSrc20(src20Factory, options, addresses);
    const event = await getEvent(transaction, 'SRC20Created');
    const src20Options = tokenContractOptions.src20;
    // console.log({ issuerAddress, tokenContractOptions, src20Options });
    expect(event.owner).to.equal(issuerAddress);
    expect(event.token).to.match(REGEX_ADDR);
    expect(event.transferRules).to.equal(transferRules.address);
    expect(event.roles).to.equal(roles.address);
    expect(event.features).to.equal(features.address);
    expect(event.name).to.equal(src20Options.name);
    expect(event.symbol).to.equal(src20Options.symbol);
    expect(event.decimals).to.equal(src20Options.decimals);
    expect(event.maxTotalSupply.toString()).to.equal(src20Options.maxSupply.toString());
    expect(await src20Registry.contains(event.token)).to.equal(true);
    expect(await assetRegistry.getNav(event.token)).to.equal(src20Options.nav);
    expect(await assetRegistry.getKyaHash(event.token)).to.equal(src20Options.kyaHash);
    expect(await assetRegistry.getKyaUrl(event.token)).to.equal(src20Options.kyaUrl);
  });
});
