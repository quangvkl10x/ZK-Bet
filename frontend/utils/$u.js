import { ethers } from "ethers";

const utils = {
  moveDecimalLeft: (str, count) => {
    let start = str.toString().length - count;
    let prePadding = "";
    while (start < 0) {
      prePadding += "0";
      start++;
    }
    str = prePadding + str;
    let result = str.slice(0, start) + "." + str.slice(start);
    if (result[0] === ".") {
      result = "0" + result;
    }
    return result;
  },
  BN256ToBin: (str) => {
    let r = BigInt(str).toString(2);
    let prePadding = "";
    while (r.length < 256) {
      prePadding += "0";
      r = prePadding + r;
    }
    return r;
  },
  BN256ToHex: (n) => {
    let nstr = BigInt(n).toString(16);
    while (nstr.length < 64) {
      nstr = "0" + nstr;
    }
    nstr = "0x" + nstr;
    return nstr;
  },
  BNToDecimal: (bn) => {
    return ethers.BigNumber.from(bn).toString();
  },
  reverseCoordinates: (p) => {
    return [p[1], p[0]];
  },
};

export default utils;
