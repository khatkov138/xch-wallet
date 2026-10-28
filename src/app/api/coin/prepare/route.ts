import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import https from "https";
import os from "os";
import { z } from "zod";
import { sha256 } from "@noble/hashes/sha2";
import { bech32m } from "bech32";
import { clvmTree, parseCLVMBytes, intToBytes, serializeSolution } from "@/lib/crypto";

const MOJO_PER_XCH = 1_000_000_000_000n, MIN_FEE = 100_000_000n;

const PrepareSchema = z.object({
  address: z.string().refine((val) => {
    try {
      const decoded = bech32m.decode(val);
      return decoded.prefix === "xch" || decoded.prefix === "txch";
    } catch { return false; }
  }, { message: "Invalid Chia address format" }),
  publicKeyHex: z.string().min(1, "publicKeyHex is required"),
});

const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const toBytes = (h: string) => {
  const c = h.replace(/^0x|\s+/g, '').toLowerCase();
  return new Uint8Array(c.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
};

export async function POST(request: NextRequest) {
  try {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
    const body = await request.json().catch(() => ({}));
    const validation = PrepareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Validation failed", issues: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { address: TARGET_ADDRESS, publicKeyHex } = validation.data;
    const genesisHex = process.env.NEXT_PUBLIC_CHIA_GENESIS_CHALLENGE;
    if (!genesisHex) throw new Error("NEXT_PUBLIC_CHIA_GENESIS_CHALLENGE missing from .env");
    const genesisChallenge = toBytes(genesisHex);

    const home = process.env.USERPROFILE || os.homedir() || "C:\\Users\\khatk";
    let sP = path.join(home, ".chia", isTestnet ? "testnet11" : "mainnet", "config", "ssl", "full_node");
    if (!fs.existsSync(path.join(sP, "private_full_node.crt"))) {
      sP = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
    }
    const agent = new https.Agent({ cert: fs.readFileSync(path.join(sP, "private_full_node.crt")), key: fs.readFileSync(path.join(sP, "private_full_node.key")), rejectUnauthorized: false });
    const rpc = async (p: string, b: any) => new Promise<any>((resolve) => {
      const d = JSON.stringify(b || {});
      const req = https.request(`https://localhost:8555${p}`, { method: "POST", agent, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(d, "utf8") } }, (res) => {
        const c: Buffer[] = []; res.on("data", (b) => c.push(b)); res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(c).toString("utf8"))); } catch { resolve({ success: false }); } });
      }); req.write(d); req.end();
    });

    // Собираем fullReveal на основе переданного клиентом публичного ключа
    const pB = toBytes(publicKeyHex);
    const cB = toBytes(process.env.NEXT_PUBLIC_CONTRACT_HEX || "");
    const pfx = toBytes("ff02ffff01"), mid = toBytes("ffff04ffff01b0"), sfx = toBytes("ff018080");
    const fullReveal = new Uint8Array(pfx.length + cB.length + mid.length + pB.length + sfx.length);
    fullReveal.set(pfx, 0); fullReveal.set(cB, pfx.length); fullReveal.set(mid, pfx.length + cB.length); fullReveal.set(pB, pfx.length + cB.length + mid.length); fullReveal.set(sfx, fullReveal.length - sfx.length);

    const contractPuzzleHash = clvmTree(parseCLVMBytes(fullReveal).node);
    
    const coinsRes = await rpc("/get_coin_records_by_puzzle_hash", { puzzle_hash: "0x" + toHex(contractPuzzleHash), include_spent_coins: false });
    const validCoin = coinsRes.coin_records?.find((r: any) => !r.spent);
    if (!validCoin) return NextResponse.json({ success: false, error: "No unspent coins found" }, { status: 404 });

    const coinAmount = BigInt(validCoin.coin.amount);
    let sendAmount = BigInt(Math.floor((Math.random() * (0.022220 - 0.011111) + 0.011111) * Number(MOJO_PER_XCH)));
    if (sendAmount > coinAmount - MIN_FEE) sendAmount = coinAmount - MIN_FEE;
    const changeAmount = coinAmount - sendAmount - MIN_FEE;

    const tPh = new Uint8Array(bech32m.fromWords(bech32m.decode(TARGET_ADDRESS).words));
    const { solutionHex, conditionsHash } = serializeSolution(tPh, sendAmount, contractPuzzleHash, changeAmount);

    const pBuf = toBytes(validCoin.coin.parent_coin_info), aBuf = intToBytes(coinAmount);
    const cIdBuf = new Uint8Array(pBuf.length + contractPuzzleHash.length + aBuf.length);
    cIdBuf.set(pBuf, 0); cIdBuf.set(contractPuzzleHash, pBuf.length); cIdBuf.set(aBuf, pBuf.length + contractPuzzleHash.length);
    const coinId = sha256(cIdBuf);

    const msg = new Uint8Array(conditionsHash.length + coinId.length + genesisChallenge.length);
    msg.set(conditionsHash, 0); msg.set(coinId, conditionsHash.length); msg.set(genesisChallenge, conditionsHash.length + coinId.length);

    return NextResponse.json({
      success: true,
      spendData: {
        msgHex: toHex(msg),
        coinSpend: {
          coin: { 
            amount: Number(coinAmount), 
            parent_coin_info: validCoin.coin.parent_coin_info, 
            puzzle_hash: "0x" + toHex(contractPuzzleHash) 
          },
          puzzle_reveal: "0x" + toHex(fullReveal), 
          solution: "0x" + solutionHex
        }
      }
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || String(e) }, { status: 500 });
  }
}
