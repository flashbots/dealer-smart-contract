//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';

contract WalruSwap {

    uint256 E18 = 10 ** 18;
    uint256 MAXIMUM = 2 ** 112; // is this a good choice?

    IERC20[] tokenContracts;

    struct offerCurve {
        uint256 nonce; // or round
        bool sellTok0;
        uint256[3] prices;
        uint256[2] amounts;
    }

    struct signStruc {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct uniV2Swap {
        bytes routerAddress;
        bytes[2] path;
        uint256 sellAmount;
    }

    constructor(address tok0, address tok1) {
        tokenContracts = [IERC20(tok0), IERC20(tok1)];
    }

    // can we save gas by changing some "memory" to "calldata"?
    function executeRound (
        uint256[] memory prices,
        offerCurve[] memory orders, 
        signStruc[] memory signatures,
        uniV2Swap[] calldata ammSwaps
    ) external {
        // require(sender == owner, ...);
        // To do: implement nonce logic
        uint n = orders.length;
        require (n <= 100, "up to 100 orders supported");

        // verify signatures and retrieve users' addresses
        address[] memory users = verifySignatures(orders, signatures, n);

        // bring funds from users
        uint256[100] memory amounts;
        for (uint i = 0; i < n; i++) {
            offerCurve memory order = orders[i];
            uint256 tokIndex = order.sellTok0? 0 : 1;
            amounts[i] = computeAmount(prices[tokIndex], order);
            tokenContracts[tokIndex].transferFrom(
                users[i], 
                address(this), 
                amounts[i]
            );
        }
        // make amm swaps
        // possible alternative: replace this by arbitrary intermediate transactions
        for (uint i = 0; i < ammSwaps.length; i++) {
            uniV2Swap calldata ammSwap = ammSwaps[i];
            IUniswapV2Router02 uniswapRouter = IUniswapV2Router02(bytesToAddress(ammSwap.routerAddress));
            address[] memory path = new address[](2);
            for (uint j = 0; j < 2; j++) {
                path[j] = bytesToAddress(ammSwap.path[j]);
            }

            // alternatively use uniswap.swapExactTokensForTokensSupportingFeeOnTransferTokens
            // 0.3% swap fee is charged to amountIn
            uniswapRouter.swapExactTokensForTokens(
                ammSwap.sellAmount,
                0,
                path,
                address(this),
                block.timestamp
            );
        }
        // pay users
        for (uint i = 0; i < n; i++) {
            offerCurve memory order = orders[i];
            uint256 tokIndex = order.sellTok0? 0 : 1;
            tokenContracts[1 - tokIndex].transfer(
                users[i], 
                prices[tokIndex] * computeAmount(prices[tokIndex], order) / E18
            );
        }
    }

    // for orders: memory, calldata?
    function verifySignatures(offerCurve[] memory orders, signStruc[] memory signatures, uint n) private pure returns (address[] memory){
        address[] memory users = new address[](100);
        for (uint i = 0; i < n; i++) {
            offerCurve memory order = orders[i];
            signStruc memory signature = signatures[i];
            bytes memory orderBytes = abi.encodePacked(
                order.nonce,
                order.sellTok0,
                order.prices,
                order.amounts
            );
            bytes32 orderHash = keccak256(orderBytes);
            bytes32 prefixedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", orderHash));
            address user = ecrecover(prefixedMessage, signature.v, signature.r, signature.s);
            users[i] = user; // is this verification enough?
        }
        return users;
    }

    function bytesToAddress(bytes memory bys) private pure returns (address addr) {
        assembly {
            addr := mload(add(bys,20))
        } 
    }   

    function approveToken(address tokenAddress, address spender) public{
        IERC20 token = IERC20(tokenAddress);
        token.approve(spender, MAXIMUM);
    }

    function computeAmount(uint256 price, offerCurve memory order) private pure returns (uint256 amount){
        // Since only the owner can run executeRound, it is up to them
        // to check that order.prices is increasing.
        // The only guarantees that this contract gives to users
        // is that it will only execute a point in their offerCurve, 
        // at most once.
        if (price <= order.prices[0]) {
            return 0;
        } else 
        if (price < order.prices[1]) {
            uint256 firstDifference = order.prices[1] - order.prices[0];
            uint256 priceDelta = price - order.prices[0];
            return order.amounts[0] * priceDelta / firstDifference;
        } else
        if (price < order.prices[2]) {
            uint256 secondDifference = order.prices[2] - order.prices[1];
            uint256 lowerPriceDelta = price - order.prices[1];
            uint256 upperPriceDelta = order.prices[2] - price;
            return (lowerPriceDelta * order.amounts[1] + upperPriceDelta * order.amounts[0]) / secondDifference;
        } else
        return order.amounts[1];
    }

    function showBytes(offerCurve memory order) public pure returns(bytes memory) {
        bytes memory orderBytes = abi.encodePacked(
            order.nonce,
            order.sellTok0,
            order.prices,
            order.amounts
        );
        return orderBytes;
    }

}