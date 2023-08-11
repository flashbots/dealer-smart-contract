import { ethers } from "hardhat"; 
import Web3, { Address } from "web3";
import * as fs from 'fs';
import { Order, SignStruc, Dict, Transaction, TransferFromUser, TransferFromFiller, FillerInput } from "./interfaces";

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

export function translateOrders(orders: Order[], tokensDict: Dict): Order[] {
    // const orders = JSON.parse(data) as Order[];
    for (const order of orders) {
        const allowedTokens = toTokAddresses(order.allowedTokens, tokensDict)
        const tokensAddresses = toTokAddresses(order.inequalities.tokensAddresses, tokensDict);
        order.allowedTokens = allowedTokens;
        order.inequalities.tokensAddresses = tokensAddresses;
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
                "address[]", 
                "tuple(address[] tokensAddresses, int[][] coefficients, int[] independentCoef)",
                "tuple(address _contract, bytes data)[]",
                "uint"
            ], 
            [order.allowedTokens, order.inequalities, order.conditions, order.expirationBlock]
        );
        messages.push(msg);
    }
    return messages;
}


export function translateFillerInput(fillerInput: FillerInput, usersDict: Dict, tokensDict: Dict)
: FillerInput {
        let transfersFromUsers = fillerInput.transfersFromUsers;
        for (let i = 0; i < transfersFromUsers.length; i++) {
            for (let j = 0; j < transfersFromUsers[i].length; j++) {
                transfersFromUsers[i][j].to = usersDict[transfersFromUsers[i][j].to];
            }
        }
        let transfersFromFiller = fillerInput.transfersFromFiller;
        for (let i = 0; i < transfersFromFiller.length; i++) {
            transfersFromFiller[i].tokenAddress = tokensDict[transfersFromFiller[i].tokenAddress];
            transfersFromFiller[i].to = usersDict[transfersFromFiller[i].to];
        }
        return fillerInput;
}

function toTokAddresses(tokens: string[], tokensDict: Dict): string[] {
    return tokens.map((name: string) => tokensDict[name]);
}

