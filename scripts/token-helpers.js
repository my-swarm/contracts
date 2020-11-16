const _ = require('lodash');
const { ethers } = require('@nomiclabs/buidler');
const { BigNumber } = ethers;
const { parseUnits } = ethers.utils;

async function getContributors(num) {
  const skipFirst = 2; // fist two accounts have other significance
  return (await ethers.getSigners()).slice(skipFirst, skipFirst + num);
}

async function getIssuer() {
  const [, issuer] = await ethers.getSigners();
  return issuer;
}

async function stakeAndMint({ src20, src20Registry, tokenMinter, swm }, nav, supply) {
  const issuer = await getIssuer();
  const stakeAmount = await tokenMinter.calcStake(nav);
  await swm.connect(issuer).approve(src20Registry.address, stakeAmount);
  await tokenMinter.connect(issuer).stakeAndMint(src20.address, supply);
}

async function updateAllowance(account, token, spenderAddress, allowance = -1) {
  if (allowance === -1) {
    allowance = BigNumber.from(2).pow(256).sub(1);
  } else {
    allowance = await sanitizeAmount(allowance, token);
  }
  await token.connect(account).approve(spenderAddress, allowance);
}

async function increaseSupply({ src20, src20Registry }, diff) {
  const issuer = await getIssuer();
  const swmAddress = await issuer.getAddress();
  await src20Registry
    .connect(issuer)
    .increaseSupply(src20.address, swmAddress, await sanitizeAmount(diff, src20));
}

async function decreaseSupply({ src20, src20Registry }, diff) {
  const issuer = await getIssuer();
  const swmAddress = await issuer.getAddress();
  await src20Registry
    .connect(issuer)
    .decreaseSupply(src20.address, swmAddress, await sanitizeAmount(diff, src20));
}

async function distributeToken(signer, token, holderAddresses, perHolder) {
  for (const holderAddress of holderAddresses) {
    token.connect(signer).transfer(holderAddress, await sanitizeAmount(perHolder, token));
  }
}

async function transferToken(token, from, toAddress, amount) {
  token.connect(from).transfer(toAddress, await sanitizeAmount(amount, token));
}

async function bulkTransfer({ src20 }, addresses, values) {
  const issuer = await getIssuer();
  await src20.connect(issuer).bulkTransfer(addresses, await sanitizeAmounts(values, src20));
}

async function contribute({ usdc, fundraiser }, as, amount, referral = '') {
  await usdc.connect(as).approve(fundraiser.address, await sanitizeAmount(amount, usdc));
  await fundraiser.connect(as).contribute(await sanitizeAmount(amount, usdc), referral);
}

async function massContribute({ usdc, fundraiser }, contributors, amounts) {
  for (const key in contributors) {
    if (amounts[key]) {
      await contribute({ usdc, fundraiser }, contributors[key], amounts[key]);
    }
  }
}

async function acceptContributors({ contributorRestrictions }, contributorAddresses) {
  const issuer = await getIssuer();
  for (const contributorAddress of contributorAddresses) {
    await contributorRestrictions.connect(issuer).whitelistAccount(contributorAddress);
  }
}

async function removeContributors({ contributorRestrictions }, contributorAddresses) {
  const issuer = await getIssuer();
  for (const contributorAddress of contributorAddresses) {
    await contributorRestrictions.connect(issuer).unWhitelistAccount(contributorAddress);
  }
}

async function refund({ fundraiser }, contributor) {
  await fundraiser.connect(contributor).getRefund();
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

async function whitelist({ transferRules }, addresses) {
  await ungreywhitelist(transferRules, addresses, true, true);
}

async function greylist({ transferRules }, addresses) {
  await ungreywhitelist(transferRules, addresses, true, false);
}

async function unwhitelist({ transferRules }, addresses) {
  await ungreywhitelist(transferRules, addresses, false, true);
}

async function ungreylist({ transferRules }, addresses) {
  await ungreywhitelist(transferRules, addresses, false, false);
}

async function approveTransfer({ transferRules }, transferId) {
  const issuer = await getIssuer();
  await transferRules.connect(issuer).approveTransfer(transferId);
}

async function denyTransfer({ transferRules }, transferId) {
  const issuer = await getIssuer();
  await transferRules.connect(issuer).denyTransfer(transferId);
}

// helper helers :)

async function sanitizeAmount(amount, token) {
  if (typeof amount === 'number') {
    const decimals = parseInt(await token.decimals());
    amount = parseUnits(amount.toString(), decimals);
  }
  return amount;
}

async function sanitizeAmounts(amounts, token) {
  const decimals = await token.decimals();
  amounts = amounts.map(async (value) =>
    typeof value === 'number' ? parseUnits(value.toString(), decimals) : value
  );
  return amounts;
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
  removeContributors,
  refund,
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
