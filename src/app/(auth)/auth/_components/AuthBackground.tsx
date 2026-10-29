'use client'

import React from "react"

export function AuthBackground() {
  return (
    <>
      <div className="absolute top-[-25%] left-[-20%] w-[140%] h-[70vh] bg-gradient-to-br from-[#FF2E93]/20 via-[#8B5CF6]/10 to-transparent blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vh] bg-[#FF2E93]/5 blur-[120px] pointer-events-none z-0" />
    </>
  )
}
