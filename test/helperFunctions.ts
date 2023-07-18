import { ethers } from "hardhat"; 
import Web3, { Address } from "web3";
import { decToHex } from 'hex2dec';
import * as fs from 'fs';
import { tokensDict } from "./constants";
import { LimitOrder, SignStruc, UniV2Swap, Surplus, OfferCurve, Dict } from "./interfaces";

export function signOrders(privateKeys: string[], userOrders: LimitOrder[]): SignStruc[] {
    const signatures: SignStruc[] = [];
    const web3 = new Web3();
    for (let i = 0; i < privateKeys.length; i++) {
        const message = orderToHexString(userOrders[i]);
        const messageHash = web3.utils.sha3(message) as string;
        let { signature, v, r, s } = web3.eth.accounts.sign(messageHash, privateKeys[i]);
        // this is because r and s sometimes come with less characters,
        // when they have leading zeros
        r = correctHexString(r, 64);
        s = correctHexString(s, 64);
        const signatureParams: SignStruc = {v: v, r: r, s: s};  
        signatures.push(signatureParams);
    }
    return signatures;
}

export function signCurveOrder(privateKeys: string[], userOrders: OfferCurve[]): SignStruc[] {
    const signatures: SignStruc[] = [];
    const web3 = new Web3();
    for (let i = 0; i < privateKeys.length; i++) {
        const message = curveOrderToHexString(userOrders[i]);
        const messageHash = web3.utils.sha3(message) as string;
        let { signature, v, r, s } = web3.eth.accounts.sign(messageHash, privateKeys[i]);
        r = correctHexString(r, 64);
        s = correctHexString(s, 64);
        const signatureParams: SignStruc = {v: v, r: r, s: s};  
        signatures.push(signatureParams);
    }
    return signatures;    
}

export function correctHexString(s: string, size: number): string {
    if (s.length < size + 2) {
        const n = size + 2 - s.length;
        const fill = "0".repeat(n);
        s = s.slice(0, 2) + fill + s.slice(2);
    }
    return s;
}

export function orderToHexString(userOrder: LimitOrder): string {
    const nonce = decToHex(String(userOrder.nonce))?.substring(2).padStart(64, '0');
    const buyToken = userOrder.buyToken.substring(2);
    const sellToken = userOrder.sellToken.substring(2);
    const firstAmount = decToHex(String(userOrder.amounts[0]))?.substring(2).padStart(64, '0');
    const secondAmount = decToHex(String(userOrder.amounts[1]))?.substring(2).padStart(64, '0');
    return '0x' + nonce + buyToken + sellToken + firstAmount + secondAmount;
}

export function curveOrderToHexString(userOrder: OfferCurve): string {
    const nonce = decToHex(String(userOrder.nonce))?.substring(2).padStart(64, '0');
    const sellTok0 = String(Number(userOrder.sellTok0)).padStart(2, '0');
    const prices0 = decToHex(String(userOrder.prices[0]))?.substring(2).padStart(64, '0');
    const prices1 = decToHex(String(userOrder.prices[1]))?.substring(2).padStart(64, '0');
    const prices2 = decToHex(String(userOrder.prices[2]))?.substring(2).padStart(64, '0');
    const amounts0 = decToHex(String(userOrder.amounts[0]))?.substring(2).padStart(64, '0');
    const amounts1 = decToHex(String(userOrder.amounts[1]))?.substring(2).padStart(64, '0');
    return '0x' + nonce + sellTok0 + prices0 + prices1 + prices2 + amounts0 + amounts1;
}

export async function getBalances(user: string, tokAddresses: string[]): Promise<bigint[]> {
    const result: bigint[] = [];
    for (const tokAddress of tokAddresses) {
        const tokContract = await ethers.getContractAt("ERC20", tokAddress);
        result.push(await tokContract.balanceOf(user));
    }
    return result;
}

export async function getManyBalances(users: Address[], tokAddresses: string[])
:Promise<bigint[][]> {
    const answer: bigint[][] = [];
    for (const user of users) {
        answer.push(await getBalances(user, tokAddresses));
    }
    return answer;
}

export async function launchToken(tokenName: string, symbol: string, amount: bigint): Promise<[any, string]> {
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy(tokenName, symbol, amount);
    const address = (await token.getAddress()).toLowerCase();
    return [token, address];
}

export function areEqual(arg0: any[], arg1: any[]) {
    const n = arg0.length;
    if (arg1.length !== n) return false;
    for (let i = 0; i < n; i++) {
        if (arg0[i] != arg1[i]) return false;
    }
    return true;
}

export function areEqualSq(arg0: any[], arg1: any[]) {
    const n = arg0.length;
    if (arg1.length !== n) return false;
    for (let i = 0; i < n; i++) {
        if (!areEqual(arg0[i], arg1[i])) return false;
    }
    return true;
}

export function readSituation(fileName: string) : string[][] {
    var poolStateString: string[] = []; 
    var usersOrdersString: string[] = [];
    var ammSwapsString: string[] = [];
    var solverGainsString: string[] = [];
    const data = fs.readFileSync('./test/data/' + fileName, 'utf-8');
    const lines = data.split('\n');
    let j = 0;
    for (let l of lines) {
        if (l == 'pool state') {j = 1; continue}
        if (l == 'users orders') {j = 2; continue}
        if (l == 'amm swaps') {j = 3; continue}
        if (l == 'solver gains') {j = 4; continue}
        if (j == 1) poolStateString.push(l);
        if (j == 2) usersOrdersString.push(l);
        if (j == 3) ammSwapsString.push(l);
        if (j == 4) solverGainsString.push(l); 
    }
    return [poolStateString, usersOrdersString, ammSwapsString, solverGainsString];
}

export function parseSituation(
    situation: [string[], string[], string[], string[]],
    tokensDict: Dict,
    routerAddress: string
): [bigint[], LimitOrder[], UniV2Swap[], Surplus[]] {
    return [
        situation[0][0].split(',').map(x => BigInt(x)),
        situation[1].map(x => parseLimitOrder(x.split(','))),
        situation[2].map(x => parseAmmSwap(routerAddress, x.split(','))),
        situation[3].map(x => parseSolverGain(x.split(',')))
    ];
}

export function parseLimitOrder(x: string[]): LimitOrder {
    const answer: LimitOrder = 
        {
            nonce: BigInt(x[0]),
            sellToken: tokensDict[x[1].trim()],
            buyToken: tokensDict[x[2].trim()],
            amounts: [BigInt(x[3]), BigInt(x[4])]
        }
    return answer;
}

export function parseAmmSwap(routerAddress: string, x: string[]): UniV2Swap {
    const answer: UniV2Swap =
        {
            routerAddress: routerAddress,
            path: [tokensDict[x[0].trim()], tokensDict[x[1].trim()]],
            sellAmount: BigInt(x[2])
        }
    return answer;
}

export function parseSolverGain(x: string[]): Surplus {
    const answer: Surplus =
        {
            token: tokensDict[x[0].trim()],
            amount: BigInt(x[1])
        }
    return answer;
}

export async function showBalances(agents: string[], agentsAddresses: string[], tokAddresses: string[]) {
    for (const [i, agent] of agentsAddresses.entries()) {
        console.log(agents[i], 'balances: ', await getBalances(agent, tokAddresses));
    }
    return;
}

export function readAuctionResult(fileName: string) : string[][] {
    var poolStateString: string[] = []; 
    var usersOrdersString: string[] = [];
    var ammSwapsString: string[] = [];
    var priceString: string[] = [];
    const data = fs.readFileSync('./test/data/' + fileName, 'utf-8');
    const lines = data.split('\n');
    let j = 0;
    for (let l of lines) {
        if (l == 'pool state') {j = 1; continue}
        if (l == 'users orders') {j = 2; continue}
        if (l == 'amm swaps') {j = 3; continue}
        if (l == 'execution prices') {j = 4; continue}
        if (j == 1) poolStateString.push(l);
        if (j == 2) usersOrdersString.push(l);
        if (j == 3) ammSwapsString.push(l);
        if (j == 4) priceString.push(l);
    }
    return [poolStateString, usersOrdersString, ammSwapsString, priceString];
}

export function readBalancesFromFile(fileName: string) : string[] {
    const data = fs.readFileSync('./test/data/' + fileName, 'utf-8');
    const lines = data.split('\n');
    return lines;
}

export function parseAuctionResult(
    auctionResult: [string[], string[], string[], string[]],
    routerAddress: string
): [bigint[], OfferCurve[], UniV2Swap[], bigint[]] {
    // TO DO: improve this by using JSON.parse
    return [
        auctionResult[0][0].split(',').map(x => BigInt(x)),
        auctionResult[1].map(x => parseOfferCurve(x.split(','))),
        auctionResult[2].map(x => parseAmmSwap(routerAddress, x.split(','))),
        auctionResult[3][0].split(',').map(x => toBigInt(x.trim(), 18))
    ];
}
function parseOfferCurve(x: string[]): any {
    const pricesString = x[2].substring(x[2].indexOf('[') + 1, x[2].indexOf(']'));
    const amountsString = x[3].substring(x[3].indexOf('[') + 1, x[3].indexOf(']'));
    const sellTok0: boolean = x[1].trim() == 'true'; // this does not look very secure
    const answer: OfferCurve = 
        {
            nonce: BigInt(x[0]),
            sellTok0: sellTok0,
            prices: pricesString.split(';').map(price => toBigInt(price, 18)),
            amounts: amountsString.split(';').map(amount => toBigInt(amount, 0)),
        }
    return answer;
}

// bigint does not support fractional numbers
// toBigInt manipulates the string to convert it to the integer part
// of num * (10 ** decimals)
function toBigInt(num: string, decimals: number): any {
    // this assumes that num has correct format
    num.trim();
    if (num.indexOf('.') == -1) num = num + '.';
    const integerMantissa: string[] = num.split('.');
    const integer = integerMantissa[0];
    // does substring here work as expected?
    const mantissa = integerMantissa[1].substring(0, decimals).padEnd(decimals, '0');
    const resultString = integer + mantissa;
    return BigInt(resultString);
}

