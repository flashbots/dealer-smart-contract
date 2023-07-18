export interface LimitOrder {
    nonce: bigint;  
    sellToken: string;
    buyToken: string;
    amounts: bigint[];
}

export interface OfferCurve {
    nonce: bigint; // or round
    sellTok0: boolean;
    prices: bigint[];
    amounts: bigint[];
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


export interface Surplus {
    token: string;
    amount: bigint;
}

export interface Dict {
    [key: string]: any;
}
