export declare const morphoAbi: readonly [{
    readonly name: "idToMarketParams";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "loanToken";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "oracle";
        }, {
            readonly type: "address";
            readonly name: "irm";
        }, {
            readonly type: "uint256";
            readonly name: "lltv";
        }];
        readonly name: "params";
    }];
}, {
    readonly name: "market";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "totalSupplyAssets";
        }, {
            readonly type: "uint128";
            readonly name: "totalSupplyShares";
        }, {
            readonly type: "uint128";
            readonly name: "totalBorrowAssets";
        }, {
            readonly type: "uint128";
            readonly name: "totalBorrowShares";
        }, {
            readonly type: "uint128";
            readonly name: "lastUpdate";
        }, {
            readonly type: "uint128";
            readonly name: "fee";
        }];
        readonly name: "m";
    }];
}, {
    readonly name: "position";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "bytes32";
        readonly name: "id";
    }, {
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "supplyShares";
        }, {
            readonly type: "uint128";
            readonly name: "borrowShares";
        }, {
            readonly type: "uint128";
            readonly name: "collateral";
        }];
        readonly name: "p";
    }];
}, {
    readonly name: "isIrmEnabled";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "irm";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}, {
    readonly name: "isLltvEnabled";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "lltv";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}];
export declare const irmAbi: readonly [{
    readonly name: "borrowRateView";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "address";
            readonly name: "loanToken";
        }, {
            readonly type: "address";
            readonly name: "collateralToken";
        }, {
            readonly type: "address";
            readonly name: "oracle";
        }, {
            readonly type: "address";
            readonly name: "irm";
        }, {
            readonly type: "uint256";
            readonly name: "lltv";
        }];
        readonly name: "marketParams";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint128";
            readonly name: "totalSupplyAssets";
        }, {
            readonly type: "uint128";
            readonly name: "totalSupplyShares";
        }, {
            readonly type: "uint128";
            readonly name: "totalBorrowAssets";
        }, {
            readonly type: "uint128";
            readonly name: "totalBorrowShares";
        }, {
            readonly type: "uint128";
            readonly name: "lastUpdate";
        }, {
            readonly type: "uint128";
            readonly name: "fee";
        }];
        readonly name: "market";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}];
export declare const tokenAbi: readonly [{
    readonly name: "decimals";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint8";
    }];
}, {
    readonly name: "symbol";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "name";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}];
