import { useState, useEffect } from 'react';
import bip39 from 'bip39';
import chiaBls from 'chia-bls';

const { PrivateKey } = chiaBls;

interface UseWalletPublicKeyProps {
  mnemonic: string;
}

interface WalletPublicKeyResult {
  masterPkHex: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useWalletPublicKey = ({ mnemonic }: UseWalletPublicKeyProps): WalletPublicKeyResult => {
  const [masterPkHex, setMasterPkHex] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cleanMnemonic = mnemonic.trim();
    if (!cleanMnemonic) {
      setMasterPkHex(null);
      setError(null);
      return;
    }

    const wordsCount = cleanMnemonic.split(/\s+/).length;
    if (wordsCount !== 12 && wordsCount !== 24) {
      setMasterPkHex(null);
      setError('Мнемоника должна содержать 12 или 24 слова.');
      return;
    }

    const generateMasterPublicKey = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (!bip39.validateMnemonic(cleanMnemonic)) {
          throw new Error('Невалидная мнемоника.');
        }

        // 1. Генерируем Seed из 24 слов кошелька
        const seed = bip39.mnemonicToSeedSync(cleanMnemonic);
        
        // 2. Получаем Master Private Key
        const masterSk = PrivateKey.fromSeed(seed);

        // 3. Извлекаем чистую G1 точку (строку Master Public Key)
        const pkHex = masterSk.getG1().toHex();

        setMasterPkHex(pkHex);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Ошибка генерации публичного ключа.');
        setMasterPkHex(null);
      } finally {
        setIsLoading(false);
      }
    };

    generateMasterPublicKey();
  }, [mnemonic]);

  return { masterPkHex, isLoading, error };
};
