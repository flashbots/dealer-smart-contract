# Dealer smart contract

This repository contains "Dealer" smart contract and test cases.
Read description and purposes [here](https://www.notion.so/flashbots/New-trends-in-decentralized-exchange-applications-exploring-the-design-space-1674e673732943769c693179d356a23c).

## Install and run instructions

Clone this repository
```
git clone https://github.com/flashbots/dealer-smart-contract
```

Install dependencies. From /dealer-smart-contract run
```
npm install
```

Patch Uniswap v2. Replace the file
```
node_modules/@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol
```
by the file
```
contracts/patched/UniswapV2Library.solx
```
The extension .solx prevents compilation. The replacement has to be renamed to .sol.

To run tests:
```shell
npx hardhat test
```
or
```shell
REPORT_GAS=true npx hardhat test
```
to display gas costs.
