export type PointRow = {
  id: string
  name: string
  location: string
  attention_cm: number
  critical_cm: number
  published: boolean
}
export type ReadingRow = {
  id: string
  point_id: string
  level_cm: number
  recorded_at: string
}
type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Row>
  Update: Partial<Row>
  Relationships: []
}
export type Database = {
  public: {
    Tables: {
      monitoring_points: Table<PointRow, 'name'>
      water_readings: Table<ReadingRow, 'point_id' | 'level_cm'>
    }
    Views: {
      monitoring_overview: {
        Row: PointRow & { level_cm: number | null; recorded_at: string | null }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
