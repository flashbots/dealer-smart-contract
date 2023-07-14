# WalruSwap

This repository contains prototypes for two solidity smart contracts and
respective testing scripts.

These smart contracts aim to enable trading mechanisms to reduce MEV.
For trading pairs with considerable activity, end users should typically 
avoid executing AMM swaps and sign instead limit orders or offer curves.

## WalruSwap contract

This contract allows the owner to execute the result of a walrasian auction for 
a trading pair A/B. The auction itself is assumed to take place elsewhere, ideally
on SUAVE. The execution takes as input two prices, a batch of users' orders and a sequence of AMM swaps. Users' orders are simplified offer curves.
One price will be the clearing price for orders selling token A while the other will apply to orders selling token B. The spread corresponds to the system fee and can be zero.

## MultiMatch contract

This contract explores the possibility of a permissionless version of CoWswap protocol. See test/data/situation2.txt and test/data/notes on situation2.txt for a simple example
illustrating the advantage of this approach against direct individual AMM swaps.

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