// REPORT_GAS=true npx hardhat test --grep multiMatch

import { ethers } from "hardhat"; 
import { Token } from "../typechain-types";
import { MAX, tokensDict, privateKeys } from "./constants";
import { launchToken, signOrders, showBalances, readSituation, parseSituation, areEqualSq, getManyBalances, readBalancesFromFile } from "./helperFunctions";
import { assert } from 'chai';

describe("multiMatch tests", async function () {
    for (let i = 0; i < 3; i++) {
        const fileName = 'situation' + String(i) + '.txt';
        it("run from txt", async function() {
            // Users, tokens and multiMatch contract setup
            const [user0, user1, user2, solver] = await ethers.getSigners();
            const MultiMatch = await ethers.getContractFactory("MultiMatch");
            const multiMatch = await MultiMatch.deploy();
            const multiMatchAddr = await multiMatch.getAddress();
            const [tokenA, addressA]: [Token, string] = await launchToken("A", "AAA", MAX);
            const [tokenB, addressB]: [Token, string] = await launchToken("B", "BBB", MAX);
            await tokenA.transfer(user1, 5000);
            await tokenB.transfer(user2, 8000);
            await tokenA.connect(user1).approve(multiMatch, MAX);
            await tokenB.connect(user1).approve(multiMatch, MAX);
            await tokenA.connect(user2).approve(multiMatch, MAX);
            await tokenB.connect(user2).approve(multiMatch, MAX);

            // Uniswap v2 setup
            const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
            const uniswapV2Factory = await UniswapV2Factory.deploy(user0.address);
            const uniswapV2FactoryAddress = await uniswapV2Factory.getAddress();
            const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
            const uniswapV2Router02 = await UniswapV2Router02.deploy(uniswapV2FactoryAddress, tokensDict['WETH']);
            const routerAddress = await uniswapV2Router02.getAddress();

            // read input
            const [poolStateString, usersOrdersString, ammSwapsString, solverGainsString] = 
                readSituation(fileName);

            tokensDict['A'] = addressA;
            tokensDict['B'] = addressB;
            const [poolState, usersOrders, ammSwaps, solverGains] = parseSituation(
                [poolStateString, usersOrdersString, ammSwapsString, solverGainsString],
                tokensDict,
                routerAddress
            );

            // Uniswap v2, pool setup
            await uniswapV2Factory.createPair(addressA, addressB);
            const poolAddr = await uniswapV2Factory.getPair(addressA, addressB);
            const pairContract = await ethers.getContractAt("UniswapV2Pair", poolAddr);
            await tokenA.connect(user0).transfer(poolAddr, poolState[0]);
            await tokenB.connect(user0).transfer(poolAddr, poolState[1]);
            await pairContract.mint(user0);
            await multiMatch.approveToken(addressA, routerAddress);
            await multiMatch.approveToken(addressB, routerAddress);

            // prepare contract input
            const pKeys = privateKeys.slice(0, usersOrders.length);
            const signatures = signOrders(pKeys, usersOrders);
            const agentsAddresses = [
                user1.address,
                user2.address,
                solver.address,
                multiMatchAddr,
                poolAddr
            ]
            const tokAddresses = [addressA, addressB];
            const agents = ['user1', 'user2', 'solver', 'multiMatch', 'pool'];

            // get expected balances from txt spec
            const [balancesBeforeSpecString, balancesAfterSpecString] = 
                readBalancesFromFile('situationBalances' + String(i) + '.txt');
            const balancesBeforeSpec: bigint[][] = JSON.parse(balancesBeforeSpecString);
            const balancesAfterSpec: bigint[][] = JSON.parse(balancesAfterSpecString);

            // get balances before operation
            const balancesBefore = await getManyBalances(agentsAddresses, tokAddresses);

            // Optionally show balances
            // console.log('before: ');
            // const agents = ['user1', 'user2', 'user3', 'walruSwap', 'pool'];
            // await showBalances(agents, agentsAddresses, tokAddresses);

            await multiMatch.connect(solver).executeOrders(
                usersOrders, signatures, ammSwaps, solverGains
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
