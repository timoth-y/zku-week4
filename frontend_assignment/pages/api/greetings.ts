import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import { Contract, providers, utils } from "ethers"
import type { NextApiRequest, NextApiResponse } from "next"

// This API can represent a backend.
// The contract owner is the only account that can call the `greet` function,
// However they will not be aware of the identity of the users generating the proofs.

var isListening = false;
var greetings: any = [];
var provider: any;
var contract: any;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!isListening) {
        provider = new providers.JsonRpcProvider("http://localhost:8545")
        contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi)

        const contractOwner = contract.connect(provider.getSigner());

        console.log("start listening");
        contractOwner.on("NewGreeting", (nickname, greeting) => {
            greetings.push({
                from: utils.toUtf8String(nickname),
                message: utils.toUtf8String(greeting)
            });
        })
        isListening = true;
    }
    res.status(200).json(greetings)
}
