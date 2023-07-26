export interface Order {
    allowedTokens: string[];
    inequalities: Inequalities;
    conditions: Transaction[];
}

export interface Inequalities{
    tokensAddresses: string[];
    coefficients: BigInt[][];
    independentCoef: BigInt[];
}

export interface TransferFromInfo {
    to: string; 
    amount: bigint;
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
