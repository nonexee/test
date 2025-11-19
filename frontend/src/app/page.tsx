import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Welcome to VendorFlow AI
        </h1>
        <p className="text-center mb-8 text-lg">
          Multi-tenant SaaS for vendor compliance management
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/login"
            prefetch={true}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Login
          </Link>
          <Link
            href="/auth/register"
            prefetch={true}
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}
