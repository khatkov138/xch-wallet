import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import https from "https"
import os from "os"
import { createApiResponse } from "@/lib/utils/server-utils"

// Отключаем панику Node.js из-за самоподписанных SSL-сертификатов Chia ноды
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// --- ТИПИЗАЦИЯ CHIA RPC ---
interface ChiaConnection {
  node_id: string;
  peer_host: string;
  peer_port: number;
  type: number; // 1 = Full Node, 2 = Harvester, и т.д.
  last_message_time: number;
  bytes_read: number;
  bytes_written: number;
}

interface BlockchainStateResponse {
  success: boolean;
  blockchain_state: {
    difficulty: number;
    space: number;
    sync: {
      sync_mode: boolean;
      sync_progress_height: number;
      sync_tip_height: number;
      synced: boolean;
    };
    peak: {
      height: number;
      header_hash: string;
      timestamp: number;
    } | null; // Может быть null, если нода только стартовала
  };
}

interface ConnectionsResponse {
  success: boolean;
  connections: ChiaConnection[];
}

// --- API ХЕНДЛЕР ---
export async function GET(): Promise<NextResponse> {
  // Оборачиваем логику в ваш системный шаблон ответов бэкенда
  return createApiResponse(async () => {
    const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === "true";
    const networkFolder = isTestnet ? "testnet11" : "mainnet";
    
    // Кроссплатформенное определение домашней директории Windows/Linux
    const homeDir = process.env.USERPROFILE || os.homedir() || process.env.HOME || "C:\\Users\\khatk";

    // 1. Пробуем дефолтный путь на основе выбранной сети из .env
    let sslPath = path.join(homeDir, ".chia", networkFolder, "config", "ssl", "full_node");
    let certPath = path.join(sslPath, "private_full_node.crt");
    let keyPath = path.join(sslPath, "private_full_node.key");

    // 2. УМНЫЙ ФОЛЛБЭК: Если для тестнета нет своих сертификатов, берем проверенные из mainnet
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.log(`[CHIA RPC STATUS] Сертификаты для ${networkFolder} не найдены. Включаем фоллбэк на mainnet...`);
      sslPath = path.join(homeDir, ".chia", "mainnet", "config", "ssl", "full_node");
      certPath = path.join(sslPath, "private_full_node.crt");
      keyPath = path.join(sslPath, "private_full_node.key");
    }

    // 3. ЖЕСТКИЙ ФОЛЛБЭК ДЛЯ WINDOWS (на случай аномалий с переменными окружения)
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      sslPath = `C:\\Users\\khatk\\.chia\\mainnet\\config\\ssl\\full_node`;
      certPath = path.join(sslPath, "private_full_node.crt");
      keyPath = path.join(sslPath, "private_full_node.key");
    }

    // Финальная проверка доступности файлов ключей перед отправкой mTLS
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`SSL-сертификаты Full Node полностью отсутствуют в системе.`);
    }

    // Создаем агент для mTLS авторизации в Chia ноде
    const agent = new https.Agent({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      rejectUnauthorized: false
    });

    // Внутренний хелпер для изоляции POST-запросов к ноде
    const fetchChiaRpc = async <T>(endpoint: string): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const req = https.request(
          `https://localhost:8555/${endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            agent: agent,
            timeout: 4000 // Защита от зависания потоков Next.js
          },
          (res) => {
            let chunks = "";
            res.on("data", (chunk: string) => { chunks += chunk; });
            res.on("end", () => {
              try {
                resolve(JSON.parse(chunks) as T);
              } catch {
                reject(new Error(`Критическая ошибка парсинга JSON для метода ${endpoint}`));
              }
            });
          }
        );

        req.on("timeout", () => {
          req.destroy();
          reject(new Error(`Превышено время ожидания (Timeout) ответа от метода ${endpoint}`));
        });

        req.on("error", (err) => reject(err));
        
        req.write(JSON.stringify({}));
        req.end();
      });
    };

    // Параллельный сбор данных с ноды через Promise.all
    const [stateData, connData] = await Promise.all([
      fetchChiaRpc<BlockchainStateResponse>("get_blockchain_state"),
      fetchChiaRpc<ConnectionsResponse>("get_connections")
    ]);

    if (!stateData.success) {
      throw new Error("Chia RPC метод get_blockchain_state вернул success: false");
    }
    if (!connData.success) {
      throw new Error("Chia RPC метод get_connections вернул success: false");
    }

    const state = stateData.blockchain_state;
    
    // Безопасная обработка высоты и прогресса на случай, если peak еще null
    const currentHeight = state.peak?.height ?? 0;
    const targetHeight = state.sync.sync_tip_height > 0 ? state.sync.sync_tip_height : currentHeight;
    
    // Считаем процент синхронизации
    let progressPercent = "0.0000";
    if (targetHeight > 0) {
      progressPercent = ((currentHeight / targetHeight) * 100).toFixed(4);
    }
    if (state.sync.synced) {
      progressPercent = "100.0000";
    }

    // ЗАЩИТА ОТ БАГА 1970 ГОДА: Парсим дату только если timestamp > 0 (транзакционный блок)
    const peakTime = state.peak && state.peak.timestamp > 0
      ? new Date(state.peak.timestamp * 1000).toLocaleString("ru-RU")
      : state.sync.synced 
        ? new Date().toLocaleString("ru-RU") 
        : "Обработка блока в реальном времени...";

    // Фильтруем подключения: берем только другие Full-ноды (тип 1)
    const fullNodeConnections = connData.connections.filter(c => c.type === 1);

    // Возвращаем чистый объект. Шаблон `createApiResponse` сам обернет его в { success: true, data: ... }
    return {
      network: networkFolder,
      isSynced: state.sync.synced,
      isSyncingMode: state.sync.sync_mode,
      currentHeight,
      targetHeight,
      progressPercent,
      difficulty: state.difficulty ?? 0,
      networkSpaceTib: state.space ? (state.space / Math.pow(1024, 4)).toFixed(2) : "0.00",
      peakTime,
      totalPeers: fullNodeConnections.length,
      peersList: fullNodeConnections.map(c => ({
        ip: c.peer_host,
        port: c.peer_port,
        trafficUpMb: (c.bytes_written / (1024 * 1024)).toFixed(2),
        trafficDownMb: (c.bytes_read / (1024 * 1024)).toFixed(2)
      }))
    };
  });
}
