import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import https from "https";
import os from "os";
import { sha256 } from "@noble/hashes/sha2";
import { bech32m } from "bech32";
import { clvmTree, parseCLVMBytes, intToBytes, serializeSolution } from "@/lib/crypto";
import { PrepareSchema } from "@/lib/validations/coin";

const DEFAULT_MIN_FEE = 100_000_000n; // 0.0001 XCH в mojo

const toHex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
const toBytes = (h: string) => {
  const c = h.replace(/^0x|\s+/g, '').toLowerCase();
  return new Uint8Array(c.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
};

function generateContractData(pkHex: string) {
  const pB = toBytes(pkHex);
  const cB = toBytes(process.env.NEXT_PUBLIC_CONTRACT_HEX || "");
  const pfx = toBytes("ff02ffff01"), mid = toBytes("ffff04ffff01b0"), sfx = toBytes("ff018080");
  
  const fullReveal = new Uint8Array(pfx.length + cB.length + mid.length + pB.length + sfx.length);
  fullReveal.set(pfx, 0); 
  fullReveal.set(cB, pfx.length); 
  fullReveal.set(mid, pfx.length + cB.length); 
  fullReveal.set(pB, pfx.length + cB.length + mid.length); 
  fullReveal.set(sfx, fullReveal.length - sfx.length);

  const contractPuzzleHash = clvmTree(parseCLVMBytes(fullReveal).node);
  return { fullReveal, contractPuzzleHash };
}

export async function POST(request: NextRequest) {
  try {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
    const body = await request.json().catch(() => ({}));
    const validation = PrepareSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ success: false, error: "Validation failed", issues: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { address: TARGET_ADDRESS, publicKeyHex, amount, minFee } = validation.data;
    
    const currentMinFee = minFee !== undefined ? BigInt(minFee) : DEFAULT_MIN_FEE;
    let sendAmount = BigInt(amount); 

    const genesisHex = process.env.NEXT_PUBLIC_CHIA_GENESIS_CHALLENGE;
    if (!genesisHex) throw new Error("NEXT_PUBLIC_CHIA_GENESIS_CHALLENGE missing from .env");
    const genesisChallenge = toBytes(genesisHex);

    // 1. Запрашиваем монеты из роута баланса
    const origin = request.nextUrl.origin;
    const balanceUrl = `${origin}/api/wallet/balance?publicKeyHex=${publicKeyHex}`;
    

    const balanceRes = await fetch(balanceUrl, { method: "GET" });
    const balanceData = await balanceRes.json();

    if (!balanceRes.ok || !balanceData.success || !balanceData.data) {
      return NextResponse.json({ 
        success: false, 
        error: balanceData.error || "Не удалось получить монеты из роута баланса" 
      }, { status: 500 });
    }

    const allAddresses = balanceData.data.addresses || [];
    let biggestCoin: any = null;
    let maxAmount = -1n;

    // Скан по всем адресам и поиск САМОЙ БОЛЬШОЙ непотраченной монеты
    for (const addrRecord of allAddresses) {
      if (addrRecord.coins && addrRecord.coins.length > 0) {
        for (const coinRecord of addrRecord.coins) {
          if (!coinRecord.spent) {
            const currentCoinAmount = BigInt(coinRecord.coin.amount);
            if (currentCoinAmount > maxAmount) {
              maxAmount = currentCoinAmount;
              biggestCoin = coinRecord;
            }
          }
        }
      }
    }

    if (!biggestCoin) {
      return NextResponse.json({ success: false, error: "No unspent coins found on any index" }, { status: 404 });
    }

    // Используем найденную самую жирную монету
    const { fullReveal, contractPuzzleHash } = generateContractData(publicKeyHex);
    const coinAmount = BigInt(biggestCoin.coin.amount);
    
    if (sendAmount > coinAmount - currentMinFee) {
      sendAmount = coinAmount - currentMinFee;
    }
    
    if (sendAmount < 0n) {
      return NextResponse.json({ success: false, error: "Coin balance is too low for the requested fee" }, { status: 400 });
    }

    const changeAmount = coinAmount - sendAmount - currentMinFee;

    const tPh = new Uint8Array(bech32m.fromWords(bech32m.decode(TARGET_ADDRESS).words));
    const { solutionHex, conditionsHash } = serializeSolution(tPh, sendAmount, contractPuzzleHash, changeAmount);

    const pBuf = toBytes(biggestCoin.coin.parent_coin_info), aBuf = intToBytes(coinAmount);
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
            parent_coin_info: biggestCoin.coin.parent_coin_info, 
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
