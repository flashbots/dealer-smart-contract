import { Dict } from "./interfaces";

export const agentsList = ['user1', 'user2', 'solver', 'multiMatch', 'pool'];
export const tokensDict: Dict = {
    WETH: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512'
};

export const MAX = BigInt(2 ** 112);

// private keys for
// 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
// 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
// 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
export const privateKey0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const privateKey1 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
export const privateKey2 = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
export const privateKey3 = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
export const privateKeys = [privateKey1, privateKey2, privateKey3];
