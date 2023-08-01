// REPORT_GAS=true npx hardhat test --grep dealer

import { ethers } from "hardhat";
import { Token } from "../typechain-types";
import { MAX, tokensDict, privateKeys } from "./constants";
import { launchToken, getManyBalances, areEqual, areEqualSq, showBalances, signMessages, buildOrders, encodeOrders, getFillerInput } from "./helperFunctions";
import { Dict } from "./interfaces";
import * as fs from 'fs';
import { assert } from 'chai';

const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

describe("dealer tests", async function () {
    for (let i = 0; i < 3; i++) {
        it("case " + i, async function () {
            // set up users
            const [user0, user1, user2, filler] = await ethers.getSigners();

            // set up Dealer contract
            const Dealer = await ethers.getContractFactory("Dealer");
            const dealer = await Dealer.deploy();
            const dealerAddr = await dealer.getAddress();

            let usersDict: Dict = {};
            usersDict['user1'] = user1.getAddress();
            usersDict['user2'] = user2.getAddress();
            usersDict['filler'] = filler.getAddress();
            usersDict['dealer'] = dealerAddr;

            // set up tokens
            const [tokenA, addressA]: [Token, string] = await launchToken('A', 'AAA', MAX);
            const [tokenB, addressB]: [Token, string] = await launchToken('B', 'BBB', MAX);
            let tokensDict: Dict = { 'WETH': wethAddress };
            tokensDict['A'] = addressA;
            tokensDict['B'] = addressB;
            const tokensContracts: Token[] = [tokenA, tokenB];
            const signers = [user1, user2, filler];
            for (let tokenContract of tokensContracts) {
                for (let signer of signers) {
                    await tokenContract.transfer(signer, 10000);
                    await tokenContract.connect(signer).approve(dealer, MAX);
                }
            }

            // Uniswap v2 setup
            const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
            const uniswapV2Factory = await UniswapV2Factory.deploy(user0.address);
            const uniswapV2FactoryAddress = await uniswapV2Factory.getAddress();
            const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
            const uniswapV2Router02 = await UniswapV2Router02.deploy(uniswapV2FactoryAddress, tokensDict['WETH']);
            const routerAddress = await uniswapV2Router02.getAddress();

            // Uniswap v2 pool setup
            await uniswapV2Factory.createPair(addressA, addressB);
            const poolAddr = await uniswapV2Factory.getPair(addressA, addressB);
            const pairContract = await ethers.getContractAt("UniswapV2Pair", poolAddr);
            await tokenA.connect(user0).transfer(poolAddr, '100000');
            await tokenB.connect(user0).transfer(poolAddr, '200000');
            await pairContract.mint(user0);
            await dealer.approveToken(addressA, routerAddress);
            await dealer.approveToken(addressB, routerAddress);

            // set contractsDict
            let contractsDict: Dict = {};
            contractsDict['uniswapV2Router02'] = uniswapV2Router02;
            contractsDict['tokenA'] = tokenA;
            contractsDict['tokenB'] = tokenB;

            // form orders from json file
            const data = fs.readFileSync('./test/data/case' + i + '/orders.json', 'utf-8');
            const orders = buildOrders(data, tokensDict);

            // get signatures
            const pKeys = privateKeys.slice(0, orders.length);
            const messages: string[] = encodeOrders(orders);
            const signatures = signMessages(pKeys, messages);

            // form data from filler
            const fillerInputString = fs.readFileSync('./test/data/case' + i + '/fillerInput.json', 'utf-8');
            const [transfersFromUsers, transfersFromFiller, transactions] =
                getFillerInput(fillerInputString, usersDict, tokensDict);
            for (let transaction of transactions) {
                const txData = JSON.parse(transaction.data);
                transaction.data = contractsDict[transaction._contract].interface.encodeFunctionData(
                    txData[0], txData[1]
                );
                transaction._contract = contractsDict[transaction._contract].getAddress();
            }

            const agentsList = ['user1', 'user2', 'filler', 'dealer'];
            const agentsAddresses = [user1.address, user2.address, filler.address, dealerAddr];
            const tokAddresses = [addressA, addressB];
            console.log('balances before: ');
            await showBalances(agentsList, agentsAddresses, tokAddresses);
            await dealer.connect(filler).fillOrders(orders, signatures, transfersFromUsers, transfersFromFiller, transactions);
            console.log('\nbalances after: ');
            await showBalances(agentsList, agentsAddresses, tokAddresses);
        });
    }
});