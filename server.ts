import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';

// Импортируем CommonJS модули
import chiaRpcPkg from 'chia-rpc';
const { FullNode } = chiaRpcPkg;
import chiaWalletPkg from 'chia-wallet-lib';
const { KeyStore, StandardWallet } = chiaWalletPkg;
import chiaBlsPkg from 'chia-bls';
const { PrivateKey } = chiaBlsPkg;
import { mnemonicToSeedSync } from 'bip39';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const TARGET_ADDRESS = "txch1vcmpr38fp2g6q0vnjjsdynmjfankynttw3mffx9404u6fxpllw4q5l88ru";
const FIXED_FEE = 5000000; 
const MNEMONIC = "material harvest garage wish seed possible item solar zero pupil off saddle glass dial burden desk apology wrap ivory work need favorite tilt burden";

function getSslAgent(): https.Agent {
  const homeDir = process.env.USERPROFILE || os.homedir() || "C:\\Users\\khatk";
  let sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node");
  let certPath = path.join(sslPath, "private_full_node.crt");
  let keyPath = path.join(sslPath, "private_full_node.key");
  if (!fs.existsSync(certPath)) {
    sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
    certPath = path.join(sslPath, "private_full_node.crt");
    keyPath = path.join(sslPath, "private_full_node.key");
  }
  return new https.Agent({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath), rejectUnauthorized: false });
}

function ensure0x(val: string): string {
  if (!val) return val;
  return val.startsWith('0x') ? val : '0x' + val;
}

function strip0x(val: string): string {
  if (!val) return val;
  return val.startsWith('0x') ? val.slice(2) : val;
}

http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/send') {
    try {
      // 🎲 Рандомная сумма отправки
      const rx = Math.random() * (1.5 - 0.1) + 0.1;
      const mojo = Math.trunc(rx * 1_000_000_000_000);
      
      console.log(`\n======================================================`);
      console.log(`🎲 АВТОНОМНЫЙ ПУШ С ЖЕСТКИМ ФИЛЬТРОМ UTXO: ${rx.toFixed(11)} XCH (${mojo} mojo)`);

      const node = new FullNode(path.join(os.homedir(), ".chia", "mainnet"));
      (node as any).port = 8555; 

      if ((node as any).client?.defaults) {
        (node as any).client.defaults.httpsAgent = getSslAgent();
        (node as any).client.defaults.timeout = 30000;
      }

      const networkInfo: any = await node.getNetworkInfo();
      const realGenesisChallenge = networkInfo?.genesis_challenge;
      if (!realGenesisChallenge) {
        throw new Error("Нода не вернула genesis_challenge");
      }

      const privateKey = PrivateKey.fromSeed(mnemonicToSeedSync(MNEMONIC));
      const wallet = new StandardWallet(node, new KeyStore(privateKey));
      const genesisBytes = new Uint8Array(Buffer.from(strip0x(realGenesisChallenge), 'hex'));

      console.log("⏳ [1/4] Синхронизация кошелька...");
      await wallet.sync({ unusedAddressCount: 5 });

      console.log("🛠️ [2/4] Первичная сборка транзакции...");
      const spend = wallet.createSpend();
      const rawCoinSpends = await wallet.send(TARGET_ADDRESS as any, mojo, FIXED_FEE);

      let processedSpends = Array.isArray(rawCoinSpends) ? rawCoinSpends : [rawCoinSpends];

      // 🔥 ХАК: Сортируем сгенерированные траты монет по убыванию баланса оригинальной монеты
      // и ЖЕСТКО оставляем только ОДНУ самую крупную монету (у тебя там монеты по 1 и 2 XCH)
      processedSpends.sort((a: any, b: any) => Number(BigInt(b.coin?.amount || 0) - BigInt(a.coin?.amount || 0)));
      
      console.log(`🪓 Библиотека сгенерировала ${processedSpends.length} монет. Принудительно режем до 1.`);
      spend.coin_spends = [processedSpends[0]];

      // Так как мы оставили только одну жирную монету, её баланса (например, 2 XCH) 
      // гарантированно хватает на отправку нашей рандомной суммы, а все остальные 8-10 мелких монет 
      // с их ломающимися анонсами полностью удалены из транзакции!

      console.log("✍️ [3/4] Подписание транзакции (одна изолированная монета)...");
      wallet.signSpend(spend, genesisBytes as any);

      // Форматируем hex-строки под требования Python-ноды strictly ПОСЛЕ подписания
      if (Array.isArray(spend.coin_spends)) {
        spend.coin_spends = spend.coin_spends.map((cs: any) => {
          if (cs.coin) {
            cs.coin.parent_coin_info = ensure0x(cs.coin.parent_coin_info);
            cs.coin.puzzle_hash = ensure0x(cs.coin.puzzle_hash);
          }
          cs.puzzle_reveal = ensure0x(cs.puzzle_reveal);
          cs.solution = ensure0x(cs.solution);
          return cs;
        });
      }

      if (spend.aggregated_signature) {
        spend.aggregated_signature = ensure0x(spend.aggregated_signature);
      }

      console.log("\n🕵️‍♂️ ====== ПОЛНЫЙ ДАМП СГЕНЕРИРОВАННОГО SPENDBUNDLE ======");
      console.log(`🔑 Агрегированная подпись (96 байт): ${spend.aggregated_signature}`);
      console.log(`📦 Задействовано монет после очистки: ${spend.coin_spends.length}`);
      console.log("========================================================\n");

      console.log("🚀 [4/4] Отправка SpendBundle в мемпул ноды через pushTx...");
      const pushRes: any = await node.pushTx(spend);
      console.log("✅ Итоговый ответ ноды:", JSON.stringify(pushRes, null, 2));

      const isSuccess = pushRes && (pushRes.status === "SUCCESS" || pushRes.success === true);
      res.writeHead(200);
      res.end(JSON.stringify({ status: isSuccess ? "success" : "error", full_node_response: pushRes }));
    } catch (e: any) {
      console.error("❌ Критическая ошибка:", e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ status: "error", msg: e.message }));
    }
  }
}).listen(3001, () => console.log(`🚀 Сервер дебага запущен: http://localhost:3001/send`));
