import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { fetchVideos, isValidUsername } from "@/lib/apify";
