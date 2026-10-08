import { NextResponse } from "next/server";
import { getNews } from "@/lib/data";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { return NextResponse.json(await getNews()); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 503 }); }
}
