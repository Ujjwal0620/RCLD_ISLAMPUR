import { NextResponse } from "next/server";
import { SERIES_CATALOG, getSeriesSlots, WEEKLY_SERIES_TABLE, WEEK_DAYS } from "@/data/batchSchedule";
export async function GET(){return NextResponse.json({series:SERIES_CATALOG.map(code=>({code,slots:getSeriesSlots(code)})),days:WEEK_DAYS,times:WEEKLY_SERIES_TABLE.map(x=>x.time),table:WEEKLY_SERIES_TABLE});}
