import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

const BLOB_KEY = process.env.BLOB_FILE_KEY || 'fuel-station-data.xlsx'
const LOCAL_FILE = path.join(process.cwd(), 'data', 'FuelStation_SalesTracker.xlsx')

export async function getWorkbook(): Promise<XLSX.WorkBook> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list, head, getDownloadUrl } = await import('@vercel/blob')
    // Try to get the blob by key
    try {
      const { blobs } = await list({ prefix: BLOB_KEY })
      if (blobs.length > 0) {
        const url = blobs[0].downloadUrl
        const res = await fetch(url)
        const buffer = await res.arrayBuffer()
        return XLSX.read(Buffer.from(buffer), { type: 'buffer', cellDates: true })
      }
    } catch {
      // Fall through to local file on error
    }
  }
  // Local dev fallback
  const buffer = fs.readFileSync(LOCAL_FILE)
  return XLSX.read(buffer, { type: 'buffer', cellDates: true })
}

export async function saveWorkbook(wb: XLSX.WorkBook): Promise<void> {
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    await put(BLOB_KEY, buffer, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      addRandomSuffix: false,
    })
    return
  }
  // Local dev: write back to file
  fs.writeFileSync(LOCAL_FILE, buffer)
}
