//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';

contract Dealer {

    // to do: also consider burnFrom
    bytes4 private constant _TRANSFER_FROM_SELECTOR = 0x23b872dd; 

    uint256 E18 = 10 ** 18;
    uint256 MAXIMUM = 2 ** 112; // is this a good choice?

    struct Order {
        bytes[] allowedTokens;
        Inequalities inequalities;
        Transaction[] conditions;
    }

    struct Inequalities {
        bytes[] tokensAddresses;
        int[][] coefficients;
        int[] independentCoef;
    }

    struct SignStruc {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Transaction{
        bytes _contract;
        bytes data;
    }

    struct TransferFromInfo{
        bytes to; 
        uint256 amount;
    }

    // can we save gas by changing some "memory" to "calldata"?
    function fillOrders (
        Order[] memory orders, 
        SignStruc[] memory signatures,
        TransferFromInfo[][] memory transfersFromInfo,
        Transaction[] memory transactions
    ) external {
        uint n = orders.length;

        // verify signatures and retrieve users' addresses
        address[] memory users = verifySignatures(orders, signatures, n);

        // move funds from users and record previous balances
        uint[][] memory previousBalances = new uint[][](n);
        for (uint i = 0; i < n; i++) {
            Order memory order = orders[i];
            for (uint j = 0; j < order.allowedTokens.length; j++) {
                TransferFromInfo memory transferFromInfo = transfersFromInfo[i][j];
                if (transferFromInfo.amount == 0) continue;
                IERC20 token = IERC20(bytesToAddress(order.allowedTokens[j]));
                token.transferFrom(users[i], bytesToAddress(transferFromInfo.to), transferFromInfo.amount);
            }
            previousBalances[i] = getBalances(users[i], order.inequalities.tokensAddresses);
        }

        // call arbitrary transactions
        for (uint i = 0; i < transactions.length; i++) {
            address smartContract = bytesToAddress(transactions[i]._contract);
            bytes memory data = transactions[i].data;
            // require that the function's name is not "transferFrom" or "burnFrom"
            bytes4 funcSelector = bytes4(data[0]) | bytes4(data[1]) >> 8 | bytes4(data[2]) >> 16 | bytes4(data[3]) >> 24;
            require(funcSelector != _TRANSFER_FROM_SELECTOR, 'transferFrom function not allowed');
            smartContract.call(data);
        }
        // verify conditions, this may involve some actions like nonce += 1
        // To improve efficiency we can implement in this contract
        // the most common conditions, like nonces and expiration times
        for (uint i = 0; i < n; i++) {
            Order memory order = orders[i];
            // check inequalities
            checkInequalities(
                getBalances(users[i], order.inequalities.tokensAddresses),
                previousBalances[i],
                order.inequalities.coefficients,
                order.inequalities.independentCoef
            );
            // check conditions
            for (uint j = 0; j < order.conditions.length; j++) {
                Transaction memory condition = order.conditions[j];
                if (condition._contract.length == 1) {
                } else {
                    address smartContract = bytesToAddress(condition._contract);
                    smartContract.call(condition.data);
                }
            }
        }
    }

    function verifySignatures(
        Order[] memory orders,
        SignStruc[] memory signatures,
        uint n
    ) private pure returns (address[] memory){
        address[] memory users = new address[](n);
        for (uint i = 0; i < n; i++) {
            Order memory order = orders[i];
            SignStruc memory signature = signatures[i];
            bytes memory orderBytes = abi.encode(order.allowedTokens, order.inequalities, order.conditions);
            bytes32 orderHash = keccak256(orderBytes); // am I doing here an unnecesary extra step?
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

    // This has to be called to grant permissions to other contracts over this one
    function approveToken(address tokenAddress, address spender) public{
        IERC20 token = IERC20(tokenAddress);
        token.approve(spender, MAXIMUM);
    }

    function checkInequalities(
        uint[] memory balances,
        uint[] memory previousBalances,
        int[][] memory coefficients, // we use a matrix to check many inequalities
        int[] memory independentCoef
    ) private pure {
        for (uint i; i < independentCoef.length; i++) {
            int total = 0;
            for (uint j; 2 * j < coefficients[i].length; j++) {
                total += coefficients[i][2 * j] * int(balances[j]); // check security of this
                total += coefficients[i][2 * j + 1] * int(previousBalances[j]);
            }
            require(total >= independentCoef[i], 'balance inequality not satisfied');
        }       
    }

    function getBalances(
        address user,
        bytes[] memory tokensAddresses
    ) private view returns(uint[] memory) {
        uint[] memory balances = new uint[](tokensAddresses.length);
        for (uint j = 0; j < tokensAddresses.length; j++) {
            IERC20 token = IERC20(bytesToAddress(tokensAddresses[j]));
            balances[j] = token.balanceOf(user);
        }
        return balances;
    }
}

// is it possible and convenient to use the type address instead of bytes
// for addresses? It could save gas and simplify code by avoiding to 
// run bytesToAddress many times.
// can we include ETH transfers?
