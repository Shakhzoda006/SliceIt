// All session data is fetched client-side in SessionClient.tsx. Keep this route
// dynamic so Vercel can serve any session ID, not only IDs known at build time.
import { SessionClient } from "./SessionClient";

export default function SessionPage() {
  return <SessionClient />;
}
