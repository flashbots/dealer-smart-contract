# WalruSwap

This repository contains "Dealer" smart contract and test cases.

## Install and run instructions

Clone this repository
```
git clone https://github.com/flashbots/walruSwap
```

Install dependencies. From /walruSwap run
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