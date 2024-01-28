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
  BNToDecimal: (bn) => {
    return ethers.BigNumber.from(bn).toString();
  }
};

export default utils;
