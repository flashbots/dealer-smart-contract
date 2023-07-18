// REPORT_GAS=true npx hardhat test --grep walruSwap

import { ethers } from "hardhat"; 
import { Token } from "../typechain-types";
import { MAX, tokensDict, privateKeys } from "./constants";
import { launchToken, signCurveOrder, readAuctionResult, 
    parseAuctionResult, getManyBalances, areEqual, areEqualSq, showBalances, readBalancesFromFile } from "./helperFunctions";
import { Transaction } from "./interfaces";
import { assert } from 'chai';

const largeBlockNumber = 1000000000000;

describe("walruSwap tests", async function () { 
    for (let i = 0; i < 2; i++ ) {
        it("run from txt", async function() {
            // Users, tokens and walruSwap contract setup
            const [user0, user1, user2, user3] = await ethers.getSigners();
            const [tokenA, addressA]: [Token, string] = await launchToken('A', 'AAA', MAX);
            const [tokenB, addressB]: [Token, string] = await launchToken('B', 'BBB', MAX);
            const WalruSwap = await ethers.getContractFactory("WalruSwap");
            const walruSwap = await WalruSwap.deploy(addressA, addressB);
            const walruSwapAddr = await walruSwap.getAddress();
            await tokenA.transfer(user1, 5000);
            await tokenB.transfer(user2, 8000);
            await tokenA.transfer(user2, 1); // non-zero balances make the main 
            await tokenB.transfer(user1, 1); // execution cheaper

            await tokenA.connect(user1).approve(walruSwap, MAX);
            await tokenB.connect(user1).approve(walruSwap, MAX);
            await tokenA.connect(user2).approve(walruSwap, MAX);
            await tokenB.connect(user2).approve(walruSwap, MAX);

            // Uniswap v2 setup
            const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
            const uniswapV2Factory = await UniswapV2Factory.deploy(user0.address);
            const uniswapV2FactoryAddress = await uniswapV2Factory.getAddress();
            const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
            const uniswapV2Router02 = await UniswapV2Router02.deploy(uniswapV2FactoryAddress, tokensDict['WETH']);
            const routerAddress = await uniswapV2Router02.getAddress();

            // read input
            const [poolStateString, usersOrdersString, ammSwapsString, pricesString] = 
            readAuctionResult('auctionResult' + String(i) + '.txt'); // maybe we unify this with readSituation
            tokensDict['A'] = addressA;
            tokensDict['B'] = addressB;
            const [poolState, usersOrders, ammSwaps, prices] = parseAuctionResult(
                [poolStateString, usersOrdersString, ammSwapsString, pricesString],
                routerAddress
            );

            // form intermediate transactions
            const intermediateTxs: Transaction[] = [];
            for (const ammSwap of ammSwaps) {
                const data = uniswapV2Router02.interface.encodeFunctionData(
                    'swapExactTokensForTokens', 
                    [
                        ammSwap.sellAmount,
                        0, // min amount of tokens back, can be zero
                        ammSwap.path,
                        walruSwapAddr, // tokens back recipient
                        largeBlockNumber // expiration
                    ]
                ); 
                const tx: Transaction = {
                    _contract: routerAddress,
                    data: data
                }
                intermediateTxs.push(tx);
            }

            // get signatures
            const pKeys = privateKeys.slice(0, usersOrders.length);
            const signatures = signCurveOrder(pKeys, usersOrders);                 

            // Uniswap v2, pool setup
            await uniswapV2Factory.createPair(addressA, addressB);
            const poolAddr = await uniswapV2Factory.getPair(addressA, addressB);
            const pairContract = await ethers.getContractAt("UniswapV2Pair", poolAddr);
            await tokenA.connect(user0).transfer(poolAddr, poolState[0]);
            await tokenB.connect(user0).transfer(poolAddr, poolState[1]);
            await pairContract.mint(user0);
            await walruSwap.approveToken(addressA, routerAddress);
            await walruSwap.approveToken(addressB, routerAddress);

            // get expected balances from txt spec
            const [balancesBeforeSpecString, balancesAfterSpecString] = 
                readBalancesFromFile('auctionBalances' + String(i) + '.txt');
            const balancesBeforeSpec: bigint[][] = JSON.parse(balancesBeforeSpecString);
            const balancesAfterSpec: bigint[][] = JSON.parse(balancesAfterSpecString);

            // get balances before operation
            const agentsAddresses = [
                user1.address,
                user2.address,
                user3.address,
                walruSwapAddr,
                poolAddr
            ]
            const tokAddresses = [addressA, addressB];
            const balancesBefore = await getManyBalances(agentsAddresses, tokAddresses);

            // Optionally show balances
            // console.log('before: ');
            // const agents = ['user1', 'user2', 'user3', 'walruSwap', 'pool'];
            // await showBalances(agents, agentsAddresses, tokAddresses);

            await walruSwap.connect(user0).executeRound(
                prices, usersOrders, signatures, intermediateTxs
            );

            // Optionally show balances
            // console.log('after: ');
            // await showBalances(agents, agentsAddresses, tokAddresses);

            // get balances after operation
            const balancesAfter = await getManyBalances(agentsAddresses, tokAddresses);

            // check consistency
            assert.isTrue(areEqualSq(balancesBeforeSpec, balancesBefore), 'incorrect initial balances');
            assert.isTrue(areEqualSq(balancesAfterSpec, balancesAfter), 'incorrect final balances');
        });
    }
});

