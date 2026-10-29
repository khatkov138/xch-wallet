'use client';

import { useState, useEffect } from 'react';
import { useWalletPublicKey } from '@/hooks/useWalletPublicKey';
import bip39 from 'bip39';
import chiaBls from 'chia-bls';
import { sha256 } from '@noble/hashes/sha2';

const { PrivateKey } = chiaBls;
const GROUP_ORDER = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

function intToBytes4(val: number): Uint8Array {
  return new Uint8Array([(val >> 24) & 0xff, (val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff]);
}

function chiaDeriveChildSkUnhardened(parentSk: any, index: number): any {
  const parentPkBytes = parentSk.getG1().toBytes();
  const indexBytes = intToBytes4(index);
  const concat = new Uint8Array(parentPkBytes.length + indexBytes.length);
  concat.set(parentPkBytes, 0); concat.set(indexBytes, parentPkBytes.length);
  const hash = sha256(concat);
  const hashBigInt = hash.reduce((acc: bigint, v: number) => (acc << 8n) + BigInt(v), 0n);
  const parentSkBigInt = parentSk.toBytes().reduce((acc: bigint, v: number) => (acc << 8n) + BigInt(v), 0n);
  const childSkBigInt = (parentSkBigInt + hashBigInt) % GROUP_ORDER;
  return PrivateKey.fromHex(childSkBigInt.toString(16).padStart(64, '0'));
}

export default function ChiaWalletSendPage() {
  const [mnemonic, setMnemonic] = useState('material harvest garage wish seed possible item solar zero pupil off saddle glass dial burden desk apology wrap ivory work need favorite tilt burden');
  const [addr] = useState('txch12dza3pwr4gzyfxgvl04tlu67nlhw5yv86sx3snkqr0tck2ss4uns4fqh9w');
  const [amount, setAmount] = useState('');
  const [fee] = useState('100000000');
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const { masterPkHex } = useWalletPublicKey({ mnemonic });

  useEffect(() => {
    setAmount((Math.random() * (0.002222 - 0.001111) + 0.001111).toFixed(6));
  }, []);

  const handleBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPkHex || !addr || !amount) return setErr('Заполните поля!');
    setLoading(true); setErr(null); setBundle(null); setTxStatus(null);
    try {
      const res = await fetch('http://localhost:8000/api/v1/transactions/build-spend-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_pk_hex: masterPkHex,
          send_to_address: addr.trim(),
          mojos_to_send: Math.round(Number(amount) * 1e12),
          fee_mojos: Number(fee)
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data, null, 2));
      setBundle(data);
    } catch (o: any) { setErr(o.message || JSON.stringify(o)); } finally { setLoading(false); }
  };

  const handleSignAndPush = async () => {
    if (!bundle) return;
    setLoading(true); setErr(null);
    try {
      if (bundle.target_wallet_index === undefined) {
        throw new Error("Бэкенд вернул структуру без target_wallet_index");
      }

      const seed = bip39.mnemonicToSeedSync(mnemonic.trim());
      const masterSk = PrivateKey.fromSeed(seed);

      let walletBranchSk = masterSk;
      walletBranchSk = chiaDeriveChildSkUnhardened(walletBranchSk, 12381);
      walletBranchSk = chiaDeriveChildSkUnhardened(walletBranchSk, 8444);
      walletBranchSk = chiaDeriveChildSkUnhardened(walletBranchSk, 2);

      const targetSk = chiaDeriveChildSkUnhardened(walletBranchSk, bundle.target_wallet_index);
      const childSkHex = Buffer.from(targetSk.toBytes()).toString('hex');

      const res = await fetch('http://localhost:8000/api/v1/transactions/send-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_pk_hex: masterPkHex,
          child_sk_hex: childSkHex,
          send_to_address: addr.trim(),
          mojos_to_send: Math.round(Number(amount) * 1e12),
          fee_mojos: Number(fee)
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data, null, 2));
      
      setTxStatus(data);
      setBundle(null);
    } catch (o: any) { setErr(o.message || JSON.stringify(o)); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-mono text-xs">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold text-amber-400">Chia Public Transaction Engine</h1>
        
        <form onSubmit={handleBuild} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
          <textarea className="w-full bg-slate-950 p-2 rounded text-slate-300 border border-slate-800" rows={2} value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} />
          
          {/* ФИКС: Добавлен флаг readOnly */}
          <input type="text" readOnly className="w-full bg-slate-950 p-2 rounded border border-slate-800 text-slate-500" value={addr} />
          
          <div className="flex gap-2">
            <input type="text" placeholder="Сумма XCH" className="w-1/2 bg-slate-950 p-2 rounded border border-slate-800" value={amount} onChange={(e) => setAmount(e.target.value)} />
            
            {/* ФИКС: Добавлен флаг readOnly */}
            <input type="number" readOnly placeholder="Комиссия (mojos)" className="w-1/2 bg-slate-950 p-2 rounded border border-slate-800 text-slate-500" value={fee} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded">
            {loading ? 'Обработка...' : '1. Сгенерировать SpendBundle'}
          </button>
        </form>

        {err && (
          <div className="bg-red-950/40 border border-red-900/60 rounded-xl overflow-hidden shadow-xl">
            <div className="px-4 py-2 bg-slate-950/80 border-b border-red-900/40 flex justify-between items-center">
              <span className="text-red-400 font-bold">⚠️ ОШИБКА КОНВЕЙЕРА:</span>
              <button onClick={() => navigator.clipboard.writeText(err)} className="text-[10px] bg-red-900/30 hover:bg-red-900/60 text-red-200 px-2 py-0.5 rounded border border-red-800 transition active:scale-95">Копировать</button>
            </div>
            <pre className="p-3 bg-slate-950 font-mono text-[11px] text-red-300 overflow-x-auto select-all max-h-48">{err}</pre>
          </div>
        )}

        {bundle && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="text-amber-400 font-bold">Бандл собран! Целевой индекс монеты: {bundle.target_wallet_index}</div>
            <div className="text-emerald-400 break-all font-bold">Оригинальный MSG Hex от Питона: {bundle.message_to_sign_hex}</div>
            <button onClick={handleSignAndPush} disabled={loading} className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded shadow-lg uppercase tracking-wider">
              {loading ? 'Подпись и пуш...' : '2. Извлечь ключ индекса и отправить транзакцию'}
            </button>
          </div>
        )}

        {txStatus && (
          <div className="bg-emerald-950/30 p-4 rounded-xl border border-emerald-800 space-y-2">
            <div className="text-emerald-400 font-bold text-sm">🎉 ТРАНЗАКЦИЯ УСПЕШНО ОТПРАВЛЕНА!</div>
            <pre className="p-2 bg-slate-950 border border-slate-800 rounded text-slate-400 max-h-40 overflow-y-auto">{JSON.stringify(txStatus, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
