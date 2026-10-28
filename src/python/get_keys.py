import os
import hashlib
from blspy import AugSchemeMPL, PrivateKey
from clvm_tools.clvmc import compile_clvm_text
from clvm_tools import binutils

MNEMONIC = "material harvest garage wish seed possible item solar zero pupil off saddle glass dial burden desk apology wrap ivory work need favorite tilt burden"
CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

def convertbits(data, frombits, tobits, pad=True):
    acc, bits, ret, maxv = 0, 0, [], (1 << tobits) - 1
    max_acc = (1 << (frombits + tobits - 1)) - 1
    for value in data:
        if value < 0 or value >> frombits: return None
        acc = ((acc << frombits) | value) & max_acc
        bits += frombits
        while bits >= tobits: bits -= tobits; ret.append((acc >> bits) & maxv)
    if pad and bits: ret.append((acc << (tobits - bits)) & maxv)
    return ret

def bech32_polymod(values):
    generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
    chk = 1
    for value in values:
        top = chk >> 25
        chk = ((chk & 0x1ffffff) << 5) ^ value
        for i in range(5): chk ^= generator[i] if ((top >> i) & 1) else 0
    return chk

def bech32m_encode(hrp, data):
    pad = [0, 0, 0, 0, 0, 0]
    mod = bech32_polymod([ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp] + data + pad) ^ 0x2bc830a3
    return hrp + "1" + "".join([CHARSET[d] for d in data + [(mod >> (5 * (5 - i))) & 31 for i in range(6)]])

def puzzle_hash_to_address(puzzle_hash: bytes, prefix="txch") -> str:
    return bech32m_encode(prefix, convertbits(list(puzzle_hash), 8, 5, True))

def clvm_sha256tree(sexp) -> bytes:
    if sexp.listp(): return hashlib.sha256(b"\x02" + clvm_sha256tree(sexp.first()) + clvm_sha256tree(sexp.rest())).digest()
    return hashlib.sha256(b"\x01" + sexp.as_atom()).digest()

def derive_wallet_keys():
    seed = hashlib.pbkdf2_hmac("sha512", MNEMONIC.encode("utf-8"), b"mnemonic", 2048, 64)
    sk_wallet = AugSchemeMPL.key_gen(seed)
    path_list = list()
    path_list.append(12381)
    path_list.append(8444)
    path_list.append(2)
    path_list.append(0)
    for path_index in path_list:
        sk_wallet = AugSchemeMPL.derive_child_sk(sk_wallet, path_index)
    return sk_wallet

def get_contract_data():
    wallet_sk = derive_wallet_keys()
    pubkey_hex = bytes(wallet_sk.get_g1()).hex()
    
    clsp_path = os.path.join(os.path.dirname(__file__), "signature.clsp")
    if not os.path.exists(clsp_path):
        raise FileNotFoundError(f"Файл не найден по пути: {clsp_path}")
        
    with open(clsp_path, "r", encoding="utf-8") as f:
        chialisp_file_code = f.read()
        
    compiled_hex = compile_clvm_text(chialisp_file_code, [])
    
    # АВТОМАТИЧЕСКОЕ УДАЛЕНИЕ ФАЙЛА main.sym ИЗ ПАПКИ СКРИПТА
    sym_path = os.path.join(os.path.dirname(__file__), "main.sym")
    if os.path.exists(sym_path):
        try:
            os.remove(sym_path)
        except Exception:
            pass
            
    puzzle_reveal_sexp = binutils.assemble(f"(a (q . {binutils.disassemble(compiled_hex)}) (c (q . 0x{pubkey_hex}) 1))")
    contract_puzzle_hash = clvm_sha256tree(puzzle_reveal_sexp)
    contract_address = puzzle_hash_to_address(contract_puzzle_hash, "txch")

    # =========================================================================
    # ДОБАВЛЕННЫЕ ДЕБАГ-ПРИНТЫ (БЕЗ ИЗМЕНЕНИЯ СТРУКТУРЫ)
    # =========================================================================
    print("\n" + "="*80)
    print(f"🔑 Публичный ключ (48 байт):       0x{pubkey_hex}")
    print(f"📄 Чистый скомпилированный хекс:   0x{compiled_hex}")
    print(f"📦 Полный байт-код Puzzle Reveal:  0x{puzzle_reveal_sexp.as_bin().hex()}")
    print(f"🎯 Итоговый хэш clvm_sha256tree:   0x{contract_puzzle_hash.hex()}")
    print("="*80 + "\n")

    return wallet_sk, puzzle_reveal_sexp, contract_puzzle_hash, contract_address

if __name__ == "__main__":
    try:
        _, _, _, addr = get_contract_data()
        print(f"[TEST KEYS] Код успешно прочитан из файла signature.clsp!")
        print(f"[TEST KEYS] Адрес смарт-контракта: {addr}")
    except Exception as e:
        print(f"[TEST KEYS] Ошибка: {e}")
