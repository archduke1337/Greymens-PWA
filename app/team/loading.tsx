export default function TeamLoading() {
  return (
    <div
      aria-label="Loading team"
      className="max-w-7xl mx-auto px-4 py-8 space-y-8"
      role="status"
    >
      <div className="space-y-2">
        <div className="h-9 w-64 bg-surface-secondary rounded-lg animate-pulse" />
        <div className="h-4 w-96 max-w-full bg-surface-secondary rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-56 bg-surface-secondary rounded-2xl animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
