const _ = require('lodash');
const {ethers} = require('@nomiclabs/buidler');
const {BigNumber} = ethers;
const {parseUnits} = ethers.utils;

async function getContributors(num) {
  const skipFirst = 2; // fist two accounts have other significance
  return (await ethers.getSigners()).slice(skipFirst, skipFirst + num);
}

async function getIssuer() {
  const [, issuer] = await ethers.getSigners();
  return issuer;
}

async function stakeAndMint({src20, src20Registry, getRateMinter, swm}, nav, supply) {
  const issuer = await getIssuer();
  const stakeAmount = await getRateMinter.calcStake(nav);
  await swm.connect(issuer).approve(src20Registry.address, stakeAmount);
  await getRateMinter.connect(issuer).stakeAndMint(src20.address, supply);
}

async function toWei(amount, token) {
  console.log('toWei', amount, typeof amount);
  if (typeof amount === 'number') {
    const decimals = parseInt(await token.decimals());
    amount = parseUnits(amount.toString(), decimals);
  }
  console.log(amount);
  return amount;
}

async function updateAllowance(account, token, spenderAddress, allowance) {
  if (allowance === -1) {
    allowance = BigNumber.from(2).pow(256).sub(1);
  } else {
    allowance = await toWei(allowance, token);
  }
  console.log('approve', token.address, spenderAddress, allowance.toString());
  await token.connect(account).approve(spenderAddress, allowance);
}

async function increaseSupply({src20, src20Registry}, diff) {
  const issuer = await getIssuer();
  diff = await toWei(diff, src20);
  console.log('increase supply', src20.address, await issuer.getAddress(), diff.toString());
  const swmAddress = await issuer.getAddress();
  await src20Registry.connect(issuer).increaseSupply(src20.address, swmAddress, diff);
}

async function decreaseSupply({src20, src20Registry}, diff) {
  const issuer = await getIssuer();
  diff = await toWei(diff, src20);
  const swmAddress = await issuer.getAddress();
  await src20Registry.connect(issuer).decreaseSupply(src20.address, swmAddress, diff);
}

async function distributeToken(signer, token, holderAddresses, perHolder) {
  for (const holderAddress of holderAddresses) {
    token.connect(signer).transfer(holderAddress, await toWei(perHolder, token));
  }
}

async function transferToken(token, from, toAddress, amount) {
  console.log('transferToken', await from.getAddress(), toAddress, amount);
  if (typeof amount === 'number') {
    const decimals = parseInt(await token.decimals());
    amount = parseUnits(amount.toString(), decimals);
  }
  token.connect(from).transfer(toAddress, amount);
}

async function bulkTransfer({src20}, addresses, values) {
  console.log('bulk transfer', addresses, values);
  const decimals = await src20.decimals();
  values = values.map(async (value) =>
    typeof value === 'number' ? parseUnits(value.toString(), decimals) : value
  );
  const issuer = await getIssuer();
  await src20.connect(issuer).bulkTransfer(addresses, values);
}

async function contribute(usdc, fundraiser, as, amount, referral = '') {
  console.log(`contribute ${usdc.address} -> ${fundraiser.address}: ${amount}`);
  await usdc.connect(as).approve(fundraiser.address, amount);
  await fundraiser.connect(as).contribute(amount, referral);
}

async function massContribute({usdc, fundraiser}, contributors, amounts) {
  for (const key in contributors) {
    if (amounts[key]) {
      await contribute(usdc, fundraiser, contributors[key], amounts[key]);
    }
  }
}

async function acceptContributors(fundraiser, contributors) {
  for (const contributor of contributors) {
    await fundraiser.acceptContributor(contributor);
  }
}

async function ungreywhitelist(transferRules, addresses, add = true, white = true) {
  const issuer = await getIssuer();
  let method = `${_.isArray(addresses) ? 'Bulk' : ''}${add ? '' : 'Un'}${
    white ? 'White' : 'Grey'
  }listAccount`;
  method = method.charAt(0).toLowerCase() + method.slice(1);
  console.log(`calling transferRules.${method}`);
  console.log('addr', addresses);
  await transferRules.connect(issuer)[method](addresses);
}

async function whitelist({transferRules}, addresses) {
  await ungreywhitelist(transferRules, addresses, true, true);
}

async function greylist({transferRules}, addresses) {
  await ungreywhitelist(transferRules, addresses, true, false);
}

async function unwhitelist({transferRules}, addresses) {
  await ungreywhitelist(transferRules, addresses, false, true);
}

async function ungreylist({transferRules}, addresses) {
  await ungreywhitelist(transferRules, addresses, false, false);
}

async function approveTransfer({transferRules}, transferId) {
  const issuer = await getIssuer();
  await transferRules.connect(issuer).approveTransfer(transferId);
}

async function denyTransfer({transferRules}, transferId) {
  const issuer = await getIssuer();
  await transferRules.connect(issuer).denyTransfer(transferId);
}

module.exports = {
  getContributors,
  stakeAndMint,
  distributeToken,
  transferToken,
  bulkTransfer,
  contribute,
  massContribute,
  acceptContributors,
  updateAllowance,
  increaseSupply,
  decreaseSupply,
  whitelist,
  greylist,
  unwhitelist,
  ungreylist,
  approveTransfer,
  denyTransfer,
};
