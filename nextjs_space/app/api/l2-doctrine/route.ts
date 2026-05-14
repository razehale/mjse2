// START ST-802D Logic — L2 Go-Around Doctrine API
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'l2-go-around-doctrine.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const doctrine = JSON.parse(raw);
    return NextResponse.json(doctrine);
  } catch (err: any) {
    console.error('L2 doctrine load error:', err);
    return NextResponse.json({ error: 'Failed to load L2 doctrine' }, { status: 500 });
  }
}
// END ST-802D Logic
