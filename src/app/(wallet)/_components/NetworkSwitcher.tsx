'use client'

import { useWalletStatus } from "@/hooks/useWalletStatus"
import { useWalletSession } from "@/store/useWalletStore"

export function NetworkSwitcher() {
  const network = useWalletSession((state) => state.network)
  const isMainnet = network === 'mainnet'

  const { isLoading, hasError, isConnecting, nodeData } = useWalletStatus()

  const currentNetworkName = nodeData?.network?.toLowerCase() ?? ''
  const isCurrentStateForSelectedNetwork = 
    (isMainnet && currentNetworkName.includes('mainnet')) || 
    (!isMainnet && currentNetworkName.includes('testnet'))

  const isOnline = !isLoading && !hasError && !isConnecting && !!nodeData && isCurrentStateForSelectedNetwork

  const mainnetDotClass = isMainnet
    ? (isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-[#FF2E93] shadow-[0_0_6px_#FF2E93] animate-pulse')
    : 'bg-zinc-800'

  const testnetDotClass = !isMainnet
    ? (isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-[#FF2E93] shadow-[0_0_6px_#FF2E93] animate-pulse')
    : 'bg-zinc-800'

  const setNet = (nextNetwork: 'mainnet' | 'testnet11') => {
    if (network === nextNetwork) return
    useWalletSession.getState().setNetwork(nextNetwork)
  }

  return (
    <div className="relative flex p-0.5 rounded-lg border border-zinc-800/40 bg-[#0c0c0e] h-7 items-center select-none w-[170px]">
      {/* Каретка */}
      <div 
        className={`absolute top-0.5 bottom-0.5 rounded-md transition-all duration-200 ease-out border bg-zinc-900/80 w-[82px] ${
          isMainnet 
            ? `left-0.5 ${isOnline ? 'border-emerald-500/20 shadow-[0_0_8px_rgba(52,211,153,0.05)]' : 'border-[#FF2E93]/20 shadow-[0_0_8px_rgba(255,46,147,0.05)]'}` 
            : `left-[85.5px] ${isOnline ? 'border-emerald-500/20 shadow-[0_0_8px_rgba(52,211,153,0.05)]' : 'border-[#FF2E93]/20 shadow-[0_0_8px_rgba(255,46,147,0.05)]'}`
        }`}
      />

      <button
        type="button"
        onClick={() => setNet('mainnet')}
        className="relative flex-1 flex items-center justify-center gap-1.5 h-full rounded-md cursor-pointer z-10 focus:outline-none"
      >
        <span className={`h-1 w-1 rounded-full transition-all duration-300 ${mainnetDotClass}`} />
        <span className={`text-[9px] font-black uppercase tracking-wider transition-colors duration-200 ${isMainnet ? 'text-white' : 'text-zinc-500'}`}>
          Mainnet
        </span>
      </button>

      <button
        type="button"
        onClick={() => setNet('testnet11')}
        className="relative flex-1 flex items-center justify-center gap-1.5 h-full rounded-md cursor-pointer z-10 focus:outline-none"
      >
        <span className={`h-1 w-1 rounded-full transition-all duration-300 ${testnetDotClass}`} />
        <span className={`text-[9px] font-black uppercase tracking-wider transition-colors duration-200 ${!isMainnet ? 'text-white' : 'text-zinc-500'}`}>
          Testnet11
        </span>
      </button>
    </div>
  )
}
