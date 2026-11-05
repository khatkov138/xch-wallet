
import Link from 'next/link';

// Отключаем валидацию мгновенной статической навигации для этого роута
export const instant = false;

export default async function NotFound() {

  return (
    <main className="min-h-screen bg-[#0b0c0e] text-[#f3f4f6] flex flex-col items-center justify-center p-6 selection:bg-[#25482e]">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-mono font-bold tracking-tighter text-[#3aac59]">
          404
        </h1>
        <div className="space-y-2">
          <h2 className="text-xl font-medium text-white">
            {/* Добавьте ключ в ваши json-словари, например "errors.page_not_found" */}
           
          </h2>
          <p className="text-sm text-[#6b7280]">
            The requested Chia cryptographic path does not exist.
          </p>
        </div>
        <Link 
          href="/" 
          className="inline-block bg-[#1c2330] hover:bg-[#242e3f] text-[#f3f4f6] text-sm font-medium py-2.5 px-6 rounded-xl transition-all duration-150 border border-[#2d3748]"
        >
          Return to Vault
        </Link>
      </div>
    </main>
  );
}
