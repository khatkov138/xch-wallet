'use client'
import React, { useState } from "react"

export function CopyAddressButton() {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText("txch1220nyw8zx9tf93jsj7hd2na2euz747ueuvj23h26q753w550uedqu4n9g8")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button 
      onClick={handleCopy} 
      className="text-zinc-400 flex items-center gap-0.5 bg-zinc-900 px-1.5 py-0.2 border border-zinc-800 rounded cursor-pointer"
    >
      {copied ? "Да!" : "Копировать"}
    </button>
  )
}
