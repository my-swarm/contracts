async function stakeAndMint({src20, src20Registry, getRateMinter, swm}, nav, supply) {
  const stakeAmount = await getRateMinter.calcStake(nav);
  await swm.approve(src20Registry.address, stakeAmount);
  await getRateMinter.stakeAndMint(src20.address, supply);
}

async function distributeErc20(usdc, holders = [], perHolder) {
  for (const holder of holders) {
    usdc.transfer(holder);
  }
}

async function contribute(fundraiser, asAddress, amount) {
  await fundraiser.contribute.connect(asAddress).contribute(amount, '');
}

async function massContribute(fundraiser, contributors, amounts) {
  for (const key in contributors) {
    if (amounts[key]) {
      await contribute(fundraiser, contributors[key], amounts[key]);
    }
  }
}

async function acceptContributors(fundraiser, contributors) {
  for (contributor of contributors) {
    await fundraiser.acceptContributor(contributor);
  }
}

module.exports = {
  stakeAndMint,
  distributeErc20,
  contribute,
  massContribute,
  acceptContributors,
};
