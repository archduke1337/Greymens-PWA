import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-3xl font-bold">Access Denied</h1>
      <p className="text-gray-500 mt-2 max-w-md">
        You are not authorized to view this page. If you believe this is a
        mistake, contact an administrator.
      </p>
      <div className="flex gap-3 mt-6 flex-wrap justify-center">
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg border hover:bg-default-100 text-sm font-medium transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
