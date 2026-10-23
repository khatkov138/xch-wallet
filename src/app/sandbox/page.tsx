'use client';

import { useState } from 'react';

export default function DebugSandbox() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  // Вшиваем твои реальные данные для автоматического заполнения полей
  const [walletPk, setWalletPk] = useState('8de54520479acafbd5fc78cd8182f225b84b1fce790880e810ece154a82e669ec5b7a04c44f77123ffcad55470ca2526');
  const [myPuzzleHash, setMyPuzzleHash] = useState('5345d885c3aa0444990cfbeabff35e9feeea1187d40d184ec01bd78b2a10af27');
  const [targetPuzzleHash, setTargetPuzzleHash] = useState('5345d885c3aa0444990cfbeabff35e9feeea1187d40d184ec01bd78b2a10af27'); // Шлем сами себе для теста
  const [amountXch, setAmountXch] = useState('0.1'); // Теперь вводим красиво в XCH

  // Константа для перевода XCH в Mojo (1 триллион)
  const MOJO_PER_XCH = 1_000_000_000_000;

  const handleTestCreate = async () => {
    setLoading(true);
    setResponse(null);
    
    // Переводим введенные XCH в Mojo, исключая ошибки округления JS
    const amountMojo = Math.round(Number(amountXch) * MOJO_PER_XCH);

    try {
      const res = await fetch('/api/chia/send/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_pk_hex: walletPk.trim(),
          puzzle_hash_hex: myPuzzleHash.trim(),
          target_puzzle_hash_hex: targetPuzzleHash.trim(),
          amount_mojo: amountMojo,
          fee_mojo: 0,
        }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      setResponse({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', background: '#0f0f11', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#00ff66' }}>🪓 Chia Wallet Debug Sandbox</h1>
      <p style={{ color: '#aaa', fontSize: '14px' }}>Поля автоматически заполнены данными твоего локального кошелька.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px', marginTop: '20px' }}>
        <label>
          <div>Wallet Public Key (HEX):</div>
          <input value={walletPk} onChange={e => setWalletPk(e.target.value)} style={inputStyle} />
        </label>

        <label>
          <div>Твой Puzzle Hash (Отправитель) (HEX):</div>
          <input value={myPuzzleHash} onChange={e => setMyPuzzleHash(e.target.value)} style={inputStyle} />
        </label>

        <label>
          <div>Puzzle Hash Получателя (HEX):</div>
          <input value={targetPuzzleHash} onChange={e => setTargetPuzzleHash(e.target.value)} style={inputStyle} />
        </label>

        <label>
          <div>Сумма отправки (в <b>XCH</b>):</div>
          <input value={amountXch} onChange={e => setAmountXch(e.target.value)} style={inputStyle} placeholder="Например: 0.1" />
          <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
            Будет отправлено на бэкэнд: <b>{Math.round(Number(amountXch) * MOJO_PER_XCH).toLocaleString()}</b> mojo
          </div>
        </label>

        <button onClick={handleTestCreate} disabled={loading} style={buttonStyle}>
          {loading ? 'Выполняется скрипт...' : 'Отправить POST на /api/chia/send/create'}
        </button>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Результат ответа бэкенда:</h3>
        <pre style={{ background: '#1c1c1f', padding: '15px', borderRadius: '6px', overflowX: 'auto', border: '1px solid #333' }}>
          {JSON.stringify(response, null, 2)}
        </pre>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  background: '#1c1c1f',
  border: '1px solid #333',
  color: '#fff',
  borderRadius: '4px',
  marginTop: '5px'
};

const buttonStyle = {
  padding: '12px',
  background: '#00ff66',
  color: '#000',
  border: 'none',
  borderRadius: '4px',
  fontWeight: 'bold',
  cursor: 'pointer',
  marginTop: '10px'
};
