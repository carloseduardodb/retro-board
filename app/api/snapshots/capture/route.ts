import { NextResponse } from "next/server";
import { captureSnapshots } from "@/lib/snapshot-capture";

export const maxDuration = 120;

async function handle() {
  const result = await captureSnapshots();

  return NextResponse.json(result, {
    status: result.errors.length > 0 && result.captured === 0 ? 500 : 200,
  });
}

export async function POST() {
  return handle();
}

// Agendadores externos (cron da Vercel, uptime pings, curl manual) chamam com
// GET. Sem este handler a rota respondia 405 e o dia passava sem virar
// histórico.
export async function GET() {
  return handle();
}
