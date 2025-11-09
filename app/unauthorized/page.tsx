export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-3xl font-bold">Access Denied</h1>
      <p className="text-gray-500 mt-2">You are not authorized to view this page.</p>
    </div>
  );
}
