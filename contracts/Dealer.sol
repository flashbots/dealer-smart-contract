//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.21;

import '@openzeppelin/contracts/interfaces/IERC20.sol';

contract Dealer {

    bytes4 private constant TRANSFER_FROM_SELECTOR = 0x23b872dd; 
    // To support tokens with burnFrom function we also need to consider BURN_FROM_SELECTOR

    uint256 MAXIMUM = 2 ** 112; // is this a good choice?

    struct Order {
        address[] allowedTokens;
        Inequalities inequalities;
        Transaction[] conditions;
    }

    struct Inequalities {
        address[] tokensAddresses;
        int[][] coefficients;
        int[] independentCoef;
    }

    struct SignStruc {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Transaction{
        address _contract;
        bytes data;
    }

    struct TransferFromUser{
        address to; 
        uint256 amount;
    }

    struct TransferFromFiller{
        address tokenAddress;
        address to; 
        uint256 amount;
    }

    // expiration feature is mandatory but not implemented yet
    function fillOrders (
        Order[] memory orders,  // if orders are calldata it takes more gas
        SignStruc[] calldata signatures,
        TransferFromUser[][] calldata transfersFromUsers,
        TransferFromFiller[] calldata transfersFromFiller,
        Transaction[] calldata transactions
    ) external {
        uint n = orders.length;

        // verify signatures and retrieve users' addresses
        address[] memory users = verifySignatures(orders, signatures, n);

        // record balances before execution
        uint[][] memory previousBalances = new uint[][](n);
        for (uint i = 0; i < n; i++) {
            previousBalances[i] = getBalances(users[i], orders[i].inequalities.tokensAddresses);
        }

        // transfers from users
        for (uint i = 0; i < n; i++) {
            Order memory order = orders[i];
            for (uint j = 0; j < order.allowedTokens.length; j++) {
                TransferFromUser memory transferFromUser = transfersFromUsers[i][j];
                if (transferFromUser.amount == 0) continue;
                IERC20 token = IERC20(order.allowedTokens[j]);
                token.transferFrom(users[i], transferFromUser.to, transferFromUser.amount);
            }
        }
        // transfers from filler
        for (uint i = 0; i < transfersFromFiller.length; i++) {
            TransferFromFiller memory transferFromFiller = transfersFromFiller[i];
            IERC20 token = IERC20(transferFromFiller.tokenAddress);
            token.transferFrom(msg.sender, transferFromFiller.to, transferFromFiller.amount);
        }

        // call arbitrary transactions
        for (uint i = 0; i < transactions.length; i++) {
            address smartContract = transactions[i]._contract;
            bytes memory data = transactions[i].data;
            // require that the function's name is not "transferFrom" or "burnFrom"
            bytes4 funcSelector = bytes4(data[0]) | bytes4(data[1]) >> 8 | bytes4(data[2]) >> 16 | bytes4(data[3]) >> 24;
            require(funcSelector != TRANSFER_FROM_SELECTOR, 'transferFrom function not allowed');
            smartContract.call(data);
        }
        // verify conditions
        // To improve efficiency we can implement in this contract the most common conditions
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
                address smartContract = condition._contract;
                smartContract.call(condition.data);
            }
        }
    }

    function verifySignatures(
        Order[] memory orders,
        SignStruc[] memory signatures,
        uint n
    ) private pure returns (address[] memory){
        unchecked{
            address[] memory users = new address[](n);
            for (uint i = 0; i < n; i++) {
                Order memory order = orders[i];
                SignStruc memory signature = signatures[i];
                bytes memory orderBytes = abi.encode(order.allowedTokens, order.inequalities, order.conditions);
                bytes32 orderHash = keccak256(orderBytes); // is this doing an unnecesary extra step?
                bytes32 prefixedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", orderHash));
                address user = ecrecover(prefixedMessage, signature.v, signature.r, signature.s);
                users[i] = user; // is this verification enough?
            }
            return users;
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
        // integrated SafeMath should prevent overflow errors
        for (uint i = 0; i < independentCoef.length; i++) {
            int total = 0;
            for (uint j = 0; 2 * j < coefficients[i].length; j++) {
                total += coefficients[i][2 * j] * int(balances[j]);
                total += coefficients[i][2 * j + 1] * int(previousBalances[j]);
            }
            require(total >= independentCoef[i], 'balance inequality not satisfied');
        } 
    }

    function getBalances(
        address user,
        address[] memory tokensAddresses
    ) private view returns(uint[] memory) {
        uint[] memory balances = new uint[](tokensAddresses.length);
        for (uint j = 0; j < tokensAddresses.length; j++) {
            IERC20 token = IERC20(tokensAddresses[j]);
            balances[j] = token.balanceOf(user);
        }
        return balances;
    }
}
