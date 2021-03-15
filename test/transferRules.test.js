const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  getIssuer,
  getAccount,
  deployBaseContracts,
  deployToken,
} = require('../scripts/deploy-helpers');

const { getRandomAddress, getRandomAddresses } = require('./test-helpers');

describe('TransferRules', async () => {
  let src20;
  let transferRules;
  let issuer;
  let issuerAddress;
  let address1;
  let addresses;
  let wrongAccount;

  before(async () => {
    const [baseContracts] = await deployBaseContracts();
    const [tokenContracts] = await deployToken(baseContracts, { features: 31 });
    transferRules = tokenContracts.transferRules;
    src20 = tokenContracts.src20;
    issuer = await getIssuer();
    issuerAddress = await issuer.getAddress();
    address1 = getRandomAddress();
    addresses = getRandomAddresses(2);
    wrongAccount = await getAccount(10);
  });

  it('Cannot set SRC20 if already set', async () => {
    // it is already set by the deploy helper
    await expect(transferRules.setSRC(getRandomAddress())).to.be.revertedWith('SRC20 already set');
  });

  // whitelist

  it('Cannot whitelist/unwhitelist if not called by issuer', async () => {
    await expect(transferRules.connect(wrongAccount).whitelistAccount(address1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(
      transferRules.connect(wrongAccount).unWhitelistAccount(address1)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Can whitelist and unwhitelist account', async () => {
    expect(await transferRules.isWhitelisted(address1)).to.equal(false);
    await expect(transferRules.connect(issuer).whitelistAccount(address1))
      .to.emit(transferRules, 'AccountWhitelisted')
      .withArgs(address1, issuerAddress);
    expect(await transferRules.isWhitelisted(address1)).to.equal(true);
    await expect(transferRules.connect(issuer).unWhitelistAccount(address1))
      .to.emit(transferRules, 'AccountUnWhitelisted')
      .withArgs(address1, issuerAddress);
    expect(await transferRules.isWhitelisted(address1)).to.equal(false);
  });

  it('Cannot bulk whtelist/unwhitelist if not called by issuer', async () => {
    await expect(
      transferRules.connect(wrongAccount).bulkWhitelistAccount(addresses)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      transferRules.connect(wrongAccount).bulkUnWhitelistAccount(addresses)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Can bulk whitelist and unwhitelist account', async () => {
    expect(await transferRules.isWhitelisted(addresses[0])).to.equal(false);
    expect(await transferRules.isWhitelisted(addresses[1])).to.equal(false);

    await expect(transferRules.connect(issuer).bulkWhitelistAccount(addresses))
      .to.emit(transferRules, 'AccountWhitelisted')
      .withArgs(addresses[0], issuerAddress)
      .and.to.emit(transferRules, 'AccountWhitelisted')
      .withArgs(addresses[1], issuerAddress);

    expect(await transferRules.isWhitelisted(addresses[0])).to.equal(true);
    expect(await transferRules.isWhitelisted(addresses[1])).to.equal(true);

    await expect(transferRules.connect(issuer).bulkUnWhitelistAccount(addresses))
      .to.emit(transferRules, 'AccountUnWhitelisted')
      .withArgs(addresses[0], issuerAddress)
      .and.to.emit(transferRules, 'AccountUnWhitelisted')
      .withArgs(addresses[1], issuerAddress);

    expect(await transferRules.isWhitelisted(addresses[0])).to.equal(false);
    expect(await transferRules.isWhitelisted(addresses[1])).to.equal(false);
  });

  // greylist

  it('Cannot greylist/ungreylist if not called by issuer', async () => {
    await expect(transferRules.connect(wrongAccount).greylistAccount(address1)).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(
      transferRules.connect(wrongAccount).unGreylistAccount(address1)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Can greylist and ungreylist account', async () => {
    expect(await transferRules.isGreylisted(address1)).to.equal(false);
    await expect(transferRules.connect(issuer).greylistAccount(address1))
      .to.emit(transferRules, 'AccountGreylisted')
      .withArgs(address1, issuerAddress);
    expect(await transferRules.isGreylisted(address1)).to.equal(true);
    await expect(transferRules.connect(issuer).unGreylistAccount(address1))
      .to.emit(transferRules, 'AccountUnGreylisted')
      .withArgs(address1, issuerAddress);
    expect(await transferRules.isGreylisted(address1)).to.equal(false);
  });

  it('Cannot bulk whtelist/ungreylist if not called by issuer', async () => {
    await expect(
      transferRules.connect(wrongAccount).bulkGreylistAccount(addresses)
    ).to.be.revertedWith('Ownable: caller is not the owner');
    await expect(
      transferRules.connect(wrongAccount).bulkUnGreylistAccount(addresses)
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Can bulk greylist and ungreylist account', async () => {
    expect(await transferRules.isGreylisted(addresses[0])).to.equal(false);
    expect(await transferRules.isGreylisted(addresses[1])).to.equal(false);

    await expect(transferRules.connect(issuer).bulkGreylistAccount(addresses))
      .to.emit(transferRules, 'AccountGreylisted')
      .withArgs(addresses[0], issuerAddress)
      .and.to.emit(transferRules, 'AccountGreylisted')
      .withArgs(addresses[1], issuerAddress);

    expect(await transferRules.isGreylisted(addresses[0])).to.equal(true);
    expect(await transferRules.isGreylisted(addresses[1])).to.equal(true);

    await expect(transferRules.connect(issuer).bulkUnGreylistAccount(addresses))
      .to.emit(transferRules, 'AccountUnGreylisted')
      .withArgs(addresses[0], issuerAddress)
      .and.to.emit(transferRules, 'AccountUnGreylisted')
      .withArgs(addresses[1], issuerAddress);

    expect(await transferRules.isGreylisted(addresses[0])).to.equal(false);
    expect(await transferRules.isGreylisted(addresses[1])).to.equal(false);
  });

  // authorize & doTransfer
  it('Does not authorize if no account listed', async () => {
    const a = getRandomAddresses(2);
    expect(await transferRules.connect(issuer).authorize(addresses[0], addresses[1], 100)).to.equal(
      false
    );
  });

  // authorize & doTransfer
  it('Does not authorize if only one listed', async () => {
    const a = getRandomAddresses(3);
    await transferRules.connect(issuer).whitelistAccount(a[1]);
    await transferRules.connect(issuer).greylistAccount(a[1]);
    expect(await transferRules.authorize(a[0], a[1], 100)).to.equal(false);
    expect(await transferRules.authorize(a[1], a[2], 100)).to.equal(false);
  });

  it('Does authorize if both listed', async () => {
    const a = getRandomAddresses(2);
    expect(await transferRules.authorize(a[0], a[1], 100)).to.equal(false);
    await transferRules.connect(issuer).whitelistAccount(a[0]);
    await transferRules.connect(issuer).greylistAccount(a[1]);
    expect(await transferRules.authorize(a[0], a[1], 100)).to.equal(true);
  });
});
