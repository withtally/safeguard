import { Signer } from "@ethersproject/abstract-signer";

export type User = {
    signer: Signer;
    address: string;
};
