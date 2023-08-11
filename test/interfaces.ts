export interface Order {
    allowedTokens: string[];
    inequalities: Inequalities;
    conditions: Transaction[];
    expirationBlock: BigInt;
}

export interface Inequalities{
    tokensAddresses: string[];
    coefficients: BigInt[][];
    independentCoef: BigInt[];
}

export interface TransferFromUser {
    to: string; 
    amount: bigint;
}

export interface TransferFromFiller {
    tokenAddress: string;
    to: string; 
    amount: bigint;
}

export interface FillerInput {
    transfersFromUsers: TransferFromUser[][];
    transfersFromFiller: TransferFromFiller[];
    transactions: Transaction[];
}

export interface SignStruc {
    v: string;
    r: string;
    s: string;
}

export interface UniV2Swap {
    routerAddress: string;
    path: string[];
    sellAmount: bigint;
}

export interface Transaction{
    _contract: string;
    data: string;
}

export interface Dict {
    [key: string]: any;
}
