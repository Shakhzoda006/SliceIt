// Server component — exports generateStaticParams for static export
// All rendering is done client-side in SessionClient.tsx
import { SessionClient } from "./SessionClient";

// Returns a placeholder — real data is always fetched client-side from the backend.
// Firebase Hosting rewrites all unknown paths to index.html (SPA mode).
export function generateStaticParams() {
  return [{ id: "1" }];
}

export default function SessionPage() {
  return <SessionClient />;
}
