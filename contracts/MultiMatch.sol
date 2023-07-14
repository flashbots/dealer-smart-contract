//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';

contract MultiMatch {

    uint256 MAXIMUM = 2 ** 112; // check this

    struct limitOrder {
        uint256 nonce;
        bytes sellToken;
        bytes buyToken;
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

    struct surplus {
        bytes token;
        uint256 amount;
    }

    function executeOrders (
        limitOrder[] memory orders, 
        signStruc[] memory signatures,
        uniV2Swap[] memory ammSwaps,
        surplus[] memory solverGains
    ) external {
        // To do: implement nonce logic
        uint n = orders.length;
        require (n <= 10, "up to 10 orders supported");
        // verify signatures and retrieve users' addresses
        address[] memory users = verifySignatures(orders, signatures, n);
        // bring funds from users
        for (uint i = 0; i < n; i++) {
            limitOrder memory order = orders[i];
            IERC20 tokenContract = IERC20(bytesToAddress(order.sellToken));
            tokenContract.transferFrom(users[i], address(this), order.amounts[0]);
        }
        // make amm swaps
        for (uint i = 0; i < ammSwaps.length; i++) {
            uniV2Swap memory ammSwap = ammSwaps[i];
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
            limitOrder memory order = orders[i];
            IERC20 tokenContract = IERC20(bytesToAddress(order.buyToken));
            tokenContract.transfer(users[i], order.amounts[1]);
        }
        // pay solver
        for (uint i = 0; i < solverGains.length; i++) {
            surplus memory solverGain = solverGains[i];
            IERC20 tokenContract = IERC20(bytesToAddress(solverGain.token));
            tokenContract.transfer(msg.sender, solverGain.amount);
        }
    }

    // for orders: memory, calldata?
    function verifySignatures(limitOrder[] memory orders, signStruc[] memory signatures, uint n) private pure returns (address[] memory){
        address[] memory users = new address[](10);
        for (uint i = 0; i < n; i++) {
            limitOrder memory order = orders[i];
            signStruc memory signature = signatures[i];
            bytes memory orderBytes = abi.encodePacked(
                order.nonce,
                order.buyToken,
                order.sellToken,
                order.amounts[0],
                order.amounts[1]
            );
            bytes32 orderHash = keccak256(orderBytes);
            bytes32 prefixedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", orderHash));
            address user = ecrecover(prefixedMessage, signature.v, signature.r, signature.s);
            users[i] = user;
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
}