# WalruSwap - Dealer contract

This repository contains "Dealer" smart contract and test cases.

The Dealer contract continues the line of CoWswap, UniswapX and others.
It is a tool for trading, where orders take the form of signed messages instead
of transactions. Orders are matched and executed by "fillers" also known as "solvers".

Anyone can be a filler without any kind of permission or staking.

## Flow summary

The flow of the main function, "fillOrders" can be summarized as follows.

(1) Verify signatures and retrieve users' addresses.

(2) Record balances before execution

(3) Move funds from users

(4) Call external transactions specified by the filler. These are arbitrary functions, with the exception of "transferFrom" and "burnFrom".

(5) Check balances inequalities, expiration time and other arbitrary conditions as specified by the users.

## Design advantages

The Dealer contract has significant advantages compared to UniswapX, which
can be grouped into functionality and efficiency.

### Functionality advantages

Transfer amounts from the users are not predetermined.
This simple fact enables a vast family of features:

(a) Partial fills. By suitably choosing the order's conditions, users
can configure their orders so that partial filling is possible. After a partial
fill, the order will still be valid so that it can be executed again until
it is fully filled or expires.

(b) More expressive orders. A limit order specifies a single price. It allows
execution prices that are better than the specified price, but it is not
able to specify different allowed amounts for different execution prices. 
The Dealer contract allows this.

The mathematical device that makes all of the above possible consists simply
of linear inequalities with the user's balances as variables.

Just as UniswapX, the Dealer contract allows custom conditions that
can be specified by the order, by calling any contract's functions.
For the sake of efficiency, it is a good idea to include in Dealer contract all of the functions that users will typically want to use. Dutch auctions can be one such example.

(c) In current version, orders do not specify the execution contract. This 
feature could be useful in a possible future where many versions with different
trade-offs are live. The same order can be executed in more than one contract.
Double execution would not be a problem by following standard practices for
the orders' conditions, just like for partial fills.

### Efficiency advantages

Since gas is expensive, it is important to choose a design that
uses as little gas as possible. Dealer contract attempts to achieve this
as follows:

(a) Since every call to a different contract is expensive, Dealer contract
makes everything it can by itself.

(a1) After the initial transfers from users, the filler is allowed to directly execute any other smart contract function directly, except for functions named transferFrom and burnFrom (otherwise the filler could simply steal the user's funds). The archetypical example for this step is an AMM swap. In case the filler wants to call several AMM swaps,
it can do so directly instead of having to set up an intermediary custom filler contract that calls the swaps at a later step.

(a2) Dealer contract calls transferFrom directly in order to avoid an extra
call to another contract like permit2. The claim here is that the advantages of using permit2 contract might be outweighted by the extra cost that has to be paid at every trade.

(b) The recipient of the initial transfers from users can be specified by the
filler at will. This feature allows to reduce the total number of token transfers
in some cases. In the simplest meaningful case, only two transfers will happen between two users. This case may happen frequently (think of the filler as one of the users, though this is not the only possibility) so it is an important case. In more complex cases, with more than two orders, it is also possible to save gas by carefully choosing the recipients of the initial transfers. This feature is not available in UniswapX.

The Dealer contract is being built with efficiency as a top priority.
The goal is to obtain the most efficient possible contract without losing functionality.
Currently, a simple swap between two users takes approximately 165K gas. This is similar
to a single AMM swap, but the cost is (indirectly) divided among the two users.
It is possible that the current version can be optimized without design changes.

### Further remarks

It is expected that most on-chain trading will soon move to this type of applications implementing the so-called account abstraction. Optimal designs are still to be discovered. The Dealer contract aims to propose new features that seem important 
enough to be adopted.

The capability of signing orders with undetermined transfer amounts opens up
the possibility of many different trader strategies, filler strategies and SUAVE applications like walrasian auctions, or other types of filler SUAVE apps.


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