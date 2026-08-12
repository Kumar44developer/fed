import { NextRequest, NextResponse } from "next/server";
import { searchProfile, isValidUsername } from "@/lib/apify";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("username") ?? "";
