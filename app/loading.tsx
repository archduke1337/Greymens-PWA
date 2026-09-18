export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div aria-label="Loading" className="text-center space-y-4" role="status">
        <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-default-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}
