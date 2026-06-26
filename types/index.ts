export type Role = 'admin' | 'worker'

export interface Profile {
  id: string
  full_name: string
  role: Role
  phone: string | null
  created_at: string
}

export interface Truck {
  id: string
  name: string
  plate_number: string
  qr_token: string
  created_at: string
}

export interface Assignment {
  id: string
  truck_id: string
  worker_id: string
  started_at: string
  ended_at: string | null
  is_active: boolean
  truck?: Truck
  worker?: Profile
}

export interface Location {
  id: string
  assignment_id: string
  truck_id: string
  worker_id: string
  latitude: number
  longitude: number
  accuracy: number | null
  speed: number | null
  heading: number | null
  recorded_at: string
}

export interface TruckPosition {
  truck_id: string
  truck_name: string
  plate_number: string
  worker_name: string
  latitude: number
  longitude: number
  accuracy: number | null
  speed: number | null
  recorded_at: string
  assignment_id: string
  is_active?: boolean
}
