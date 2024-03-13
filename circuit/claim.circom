pragma circom 2.0.0;

// y = (x + 1000000007) ^ 2 + (gameId + 1000000007) ^ 2 + (secret + 1000000007) ^ 2
template Bet(){
    signal input x;
    signal input gameId;
    signal input secret;

    signal input y;

    signal tmp0 <== x + 1000000007;
    signal tmp1 <== gameId + 1000000007;
    signal tmp2 <== secret + 1000000007;

    signal sqr0 <== tmp0 * tmp0;
    signal sqr1 <== tmp1 * tmp1;
    signal sqr2 <== tmp2 * tmp2;
    
    signal sum0 <== sqr0 + sqr1;
    y === sum0 + sqr2;
}

component main {public [x, y]} = Bet();