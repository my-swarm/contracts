# Swarm contract suite

This repository contains the complete issuance contract/fundraising contract suite, along with tests
and a few deployment scenarios.

This is a community driven fork of the first contract suite ([github.com/swarmfund/swarm-compliant-contract](https://github.com/swarmfund/swarm-compliant-contract)). The main advantages of the new suite being
- up to date code (using solidity 0.7)
- fundraising model simplifications (stablecoin contributions only)
- overall code refactoring and simplifications
- good test coverage 

## Tests
Run the test suite with

    yarn test

## Development

To spin a local hardhat network and automatically deploy on it, use the following scripts.

To deploy the base contracts (registry, minter, mock erc20 tokens for SWM and USDC).

    yard dev:base 

To deploy the base contracts **plus** a few testing SRC20 tokens.

    yarn dev:issuance  

## Deployment

To deploy to a specific network, use the the following script:
    
    yarn deploy <network>
     
Make sure the network is configured in `hardhat.config.js`. Also Note that this only deploys the
base ontracts. Actual SRC20 tokens are expected to be deployed through the 
[Isuannce Dapp](https://github.com/my-swarm/issuance). 

Feel free to build your own deployment scenarios using the bundled deployment and token helpers. 
The unit tests and the deploy-issuance script should work as a good reference.
  
## Code Audit

The code is currently being submitted for audit. We will update the status here when the audit is finished.