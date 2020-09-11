## Setup for issuance app

Issuance app expects some contracts to be pre-deployed before deploying per-token contract instances. To run a local
node with all the required contracts deployed, run

    yarn dev:issuance
    
The NPM script spins up a buidler node and after that runs the deployment script. The contract addresses will be displayed.
