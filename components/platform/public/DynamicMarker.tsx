import { Suspense } from "react";
import { connection } from "next/server";

async function Connection() {
  await connection();
  return null;
}

// Renders nothing. Pages whose titles come from the database add it to tell Next.js the request-time metadata is intentional.
export default function DynamicMarker() {
  return (
    <Suspense>
      <Connection />
    </Suspense>
  );
}
