// REPORT_GAS=true npx hardhat test --grep dealer

import { ethers, network } from "hardhat";
import { Token } from "../typechain-types";
import { MAX, privateKeys } from "./constants";
import { launchToken, showBalances, signMessages, translateOrders, encodeOrders, translateFillerInput } from "./helperFunctions";
import { Dict, FillerInput, Order } from "./interfaces";
import * as fs from 'fs';

describe("dealer tests", async function () {

    beforeEach(async function () {
        await network.provider.send("hardhat_reset");
    })

    for (let i = 1; i <= 4; i++) {
        it("case " + i, async function () {
            // set up users
            const [user0, user1, user2, user3, user4, user5, filler] = 
                await ethers.getSigners();

            // set up Dealer contract
            const Dealer = await ethers.getContractFactory("Dealer");
            const dealer = await Dealer.deploy();
            const dealerAddr = await dealer.getAddress();

            let usersDict: Dict = {};
            usersDict['user1'] = user1.getAddress();
            usersDict['user2'] = user2.getAddress();
            usersDict['user3'] = user3.getAddress();
            usersDict['user4'] = user4.getAddress();
            usersDict['user5'] = user5.getAddress();
            usersDict['filler'] = filler.getAddress();
            usersDict['dealer'] = dealerAddr;

            // set up tokens
            const [tokenA, addressA]: [Token, string] = await launchToken('A', 'AAA', MAX);
            const [tokenB, addressB]: [Token, string] = await launchToken('B', 'BBB', MAX);
            const [tokenC, addressC]: [Token, string] = await launchToken('C', 'CCC', MAX);
            let tokensDict: Dict = {};
            tokensDict['A'] = addressA;
            tokensDict['B'] = addressB;
            tokensDict['C'] = addressC;
            const tokensContracts: Token[] = [tokenA, tokenB, tokenC];
            const signers = [user1, user2, user3, user4, user5, filler];
            
            for (let tokenContract of tokensContracts) {
                for (let signer of signers) {
                    await tokenContract.transfer(signer, 1000000);
                    await tokenContract.connect(signer).approve(dealer, MAX);
                }
            }

            // Uniswap v2 setup
            const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
            const uniswapV2Factory = await UniswapV2Factory.deploy(user0.address);
            const uniswapV2FactoryAddress = await uniswapV2Factory.getAddress();
            const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
            const wethAddress = '0x0000000000000000000000000000000000000000'; 
            const uniswapV2Router02 = await UniswapV2Router02.deploy(uniswapV2FactoryAddress, wethAddress);
            const routerAddress = await uniswapV2Router02.getAddress();

            // Uniswap v2 pool setup
            await uniswapV2Factory.createPair(addressA, addressB);
            const poolAddr = await uniswapV2Factory.getPair(addressA, addressB);
            const pairContract = await ethers.getContractAt("UniswapV2Pair", poolAddr);
            await tokenA.connect(user0).transfer(poolAddr, '10000000');
            await tokenB.connect(user0).transfer(poolAddr, '20000000');
            await pairContract.mint(user0);
            await dealer.approveToken(addressA, routerAddress);
            await dealer.approveToken(addressB, routerAddress);

            // set contractsDict
            let contractsDict: Dict = {};
            contractsDict['uniswapV2Router02'] = uniswapV2Router02;
            contractsDict['tokenA'] = tokenA;
            contractsDict['tokenB'] = tokenB;
            contractsDict['tokenC'] = tokenC;

            // read json files
            const ordersData = fs.readFileSync('./test/data/case' + i + '/orders.json', 'utf-8');
            const fillerInputString = fs.readFileSync('./test/data/case' + i + '/fillerInput.json', 'utf-8');
            const ordersVector = JSON.parse(ordersData) as Order[][];
            const fillerInputVector = JSON.parse(fillerInputString) as FillerInput[];

            for (let i = 0; i < ordersVector.length; i++) {
                // translate orders
                const orders = translateOrders(ordersVector[i], tokensDict);

                // get signatures
                const pKeys = privateKeys.slice(0, orders.length);
                const messages: string[] = encodeOrders(orders);
                const signatures = signMessages(pKeys, messages);
    
                // translate filler input
                const fillerInput = translateFillerInput(fillerInputVector[i], usersDict, tokensDict);
                const transfersFromUsers = fillerInput.transfersFromUsers;
                const transfersFromFiller = fillerInput.transfersFromFiller;
                const transactions = fillerInput.transactions;
                for (let transaction of transactions) {
                    const txData = JSON.parse(transaction.data);
                    transaction.data = contractsDict[transaction._contract].interface.encodeFunctionData(
                        txData[0], txData[1]
                    );
                    transaction._contract = contractsDict[transaction._contract].getAddress();
                }
    
                const agentsList = ['user1', 'user2', 'user3', 'user4', 'user5', 'filler', 'dealer'];
                const agentsAddresses = [user1.address, user2.address, user3.address, user4.address, user5.address, filler.address, dealerAddr];
                const tokAddresses = [addressA, addressB, addressC];
                console.log('balances before: ');
                await showBalances(agentsList, agentsAddresses, tokAddresses);
                await showBalances(['pool'], [poolAddr], tokAddresses);
                await dealer.connect(filler).fillOrders(orders, signatures, transfersFromUsers, transfersFromFiller, transactions);
                console.log('\nbalances after: ');
                await showBalances(agentsList, agentsAddresses, tokAddresses);
                await showBalances(['pool'], [poolAddr], tokAddresses);    
            }
        });
    }
});

