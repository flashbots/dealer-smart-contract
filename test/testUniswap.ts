// REPORT_GAS=true npx hardhat test --grep uniswap
/*
import { ethers } from "hardhat"; 
import { TokenA, TokenB } from "../typechain-types";

const MAX = BigInt(2 ** 112);

interface Dict {
    [key: string]: any;
}

const tokensDict: Dict = {
    'A': '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
    'B': '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
    WETH: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512'
};

const agentsList = ['user1'];

describe("test uniswap pool", async function () {
    it("make swap", async function() {
        const [user0, user1, user2, solver] = await ethers.getSigners();

        const [tokenA, addressA]: [TokenA, string] = await launchToken("TokenA", 1000000);
        const [tokenB, addressB]: [TokenB, string] = await launchToken("TokenB", 1000000);
        await tokenA.transfer(user1, 5000);
        await tokenB.transfer(user1, 10000);

        const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
        const uniswapV2Factory = await UniswapV2Factory.deploy(user0.address);
        const uniswapV2FactoryAddress = await uniswapV2Factory.getAddress();
        const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02");
        const uniswapV2Router02 = await UniswapV2Router02.deploy(uniswapV2FactoryAddress, tokensDict['WETH']);
        await uniswapV2Factory.createPair(addressA, addressB);
        const routerAddress = await uniswapV2Router02.getAddress();
        const poolAddr = await uniswapV2Factory.getPair(addressA, addressB);
        const pairContract = await ethers.getContractAt("UniswapV2Pair", poolAddr);
        await tokenA.connect(user0).transfer(poolAddr, 100000n);
        await tokenB.connect(user0).transfer(poolAddr, 200000n);
        await pairContract.mint(user0);

        const path1 = [addressA, addressB];
        const path2 = [addressB, addressA];
        await tokenA.connect(user1).approve(uniswapV2Router02, 100000000000000);
        await tokenB.connect(user1).approve(uniswapV2Router02, 100000000000000);

        const tokAddresses = [addressA, addressB];
        await showBalances([user1.address], tokAddresses);

        await uniswapV2Router02.connect(user1).swapExactTokensForTokens(
            1126, 0, path1, user1.address, 2688075016n
        )

        await showBalances([user1.address], tokAddresses);

    });

    async function launchToken(tokenName: string, amount: number): Promise<[any, string]> {
        const Token = await ethers.getContractFactory(tokenName);
        const token = await Token.deploy(amount);
        const address = (await token.getAddress()).toLowerCase();
        return [token, address];
    }
   
    async function getBalances(user: string, tokAddresses: string[]): Promise<bigint[]> {
        const result: bigint[] = [];
        for (const tokAddress of tokAddresses) {
            const tokContract = await ethers.getContractAt("ERC20", tokAddress);
            result.push(await tokContract.balanceOf(user));
        }
        return result;
    }
   
    async function showBalances(agentsAddresses: string[], tokAddresses: string[]) {
        for (const [i, agent] of agentsAddresses.entries()) {
            console.log(agentsList[i], 'balances: ', await getBalances(agent, tokAddresses));
        }
        return;
    }
});
*/