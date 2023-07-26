import { ethers } from "hardhat"; 
import Web3, { Address } from "web3";
import * as fs from 'fs';
import { tokensDict } from "./constants";
import { Order, SignStruc, UniV2Swap, Dict, Transaction, TransferFromInfo } from "./interfaces";

export function signMessages(privateKeys: string[], messages: string[]): SignStruc[] {
    const signatures: SignStruc[] = [];
    const web3 = new Web3();
    for (let i = 0; i < privateKeys.length; i++) {
        const message = messages[i];
        const messageHash = web3.utils.sha3(message) as string;
        let { signature, v, r, s } = web3.eth.accounts.sign(messageHash, privateKeys[i]);
        r = correctHexString(r, 64);
        s = correctHexString(s, 64);
        const signatureParams: SignStruc = {v: v, r: r, s: s};  
        signatures.push(signatureParams);
    }
    return signatures;    
}

// This is ugly, how can it be improved?
export function correctHexString(s: string, size: number): string {
    if (s.length < size + 2) {
        const n = size + 2 - s.length;
        const fill = "0".repeat(n);
        s = s.slice(0, 2) + fill + s.slice(2);
    }
    return s;
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

export async function showBalances(agents: string[], agentsAddresses: string[], tokAddresses: string[]) {
    for (const [i, agent] of agentsAddresses.entries()) {
        console.log(agents[i], 'balances: ', await getBalances(agent, tokAddresses));
    }
    return;
}

export function readBalancesFromFile(fileName: string) : string[] {
    const data = fs.readFileSync('./test/data/' + fileName, 'utf-8');
    const lines = data.split('\n');
    return lines;
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

export function encodeCustomTransactions(
    conditions: Transaction[],
    tokensDict: Dict   
): Transaction[] {
    const abiCoder = new ethers.AbiCoder();
    const transactions: Transaction[] = conditions.map(
        (condition) => {
            if (condition._contract = "0x00") {
                const dataArray = JSON.parse(condition.data as string);
                const tokensAddresses: string[] = dataArray[0].map((name: string) => tokensDict[name]);
                const coefficients: bigint[][] = dataArray[1];
                const independentCoef: bigint[] = dataArray[2];
                const data = abiCoder.encode(["bytes[]", "int[][]", "int[]"],
                    [tokensAddresses, coefficients, independentCoef]
                )
                const transaction: Transaction = {
                    _contract: condition._contract as string,
                    data: data
                }
                return transaction
            } else {
                return condition;
            }
        }
    )
    return transactions;
}

export function buildOrders(data: any, tokensDict: Dict): Order[] {
    const ordersFromFile = JSON.parse(data) as Order[];
    const orders: Order[] = [];
    for (const orderFromFile of ordersFromFile) {
        const allowedTokens = toTokAddresses(orderFromFile.allowedTokens, tokensDict)
        const tokensAddresses = toTokAddresses(orderFromFile.inequalities.tokensAddresses, tokensDict);
        let inequalities = orderFromFile.inequalities;
        inequalities.tokensAddresses = tokensAddresses;
        const conditions: Transaction[] = 
            encodeCustomTransactions(orderFromFile.conditions, tokensDict);
        const order: Order = {
            allowedTokens: allowedTokens,
            inequalities: inequalities,
            conditions: conditions
        };
        orders.push(order);
    }
    return orders;
}

export function encodeOrders(orders: Order[]): string[] {
    const abiCoder = new ethers.AbiCoder();
    const messages: string[] = [];
    for (const order of orders) {
        // is it possible to directly encode 'order'?
        const msg = abiCoder.encode(
            [
                "bytes[]", 
                "tuple(bytes[] tokensAddresses, int[][] coefficients, int[] independentCoef)",
                "tuple(bytes _contract, bytes data)[]"
            ], 
            [order.allowedTokens, order.inequalities, order.conditions]
        );
        messages.push(msg);
    }
    return messages;
}


export function getFillerInput(fillerDataString: string, usersDict: Dict)
: [transferFromInfo: TransferFromInfo[], transactions: Transaction[]] {
        const fillerData = JSON.parse(fillerDataString) as 
            {
                transferFromInfoArray: TransferFromInfo[],
                transactions: Transaction[]
            };
        let transfersFromInfo = fillerData.transferFromInfoArray;
        transfersFromInfo.map((info) => {
            info.to = usersDict[info.to]; 
            return info; 
        });
        return [transfersFromInfo, fillerData.transactions];
}

function toTokAddresses(tokens: string[], tokensDict: Dict): string[] {
    return tokens.map((name: string) => tokensDict[name]);
}

