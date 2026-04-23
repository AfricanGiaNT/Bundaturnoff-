export const MANAGER_LEVEL_ROLES = [
  'OPERATIONS_DIRECTOR',
  'FUEL_MANAGER',
  'CONSTRUCTION_COORDINATOR',
  'OWNER',
] as const

export const ALL_ROLES = [
  'OPERATIONS_DIRECTOR',
  'FUEL_MANAGER',
  'CONSTRUCTION_COORDINATOR',
  'HR',
  'ACCOUNTANT',
  'QA',
  'WAREHOUSE',
  'OWNER',
  'PUMP_ATTENDANT',
  'SITE_WORKER',
] as const

export type AppRole = typeof ALL_ROLES[number]

export function isManagerLevel(role: string): boolean {
  return (MANAGER_LEVEL_ROLES as readonly string[]).includes(role)
}

export function canSeeEntity(role: string, entity: string): boolean {
  if (role === 'OPERATIONS_DIRECTOR') return true
  if (role === 'FUEL_MANAGER') return entity === 'FUEL_STATION' || entity === 'BOTH'
  if (role === 'CONSTRUCTION_COORDINATOR') return entity === 'CONSTRUCTION' || entity === 'BOTH'
  return true
}

export const ROLE_LABELS: Record<string, string> = {
  OPERATIONS_DIRECTOR: 'Operations Director',
  FUEL_MANAGER: 'Fuel Manager',
  CONSTRUCTION_COORDINATOR: 'Construction Coordinator',
  HR: 'HR Officer',
  ACCOUNTANT: 'Accountant',
  QA: 'QA Officer',
  WAREHOUSE: 'Warehouse Clerk',
  OWNER: 'Owner',
  PUMP_ATTENDANT: 'Pump Attendant',
  SITE_WORKER: 'Site Worker',
  // Legacy role labels (backward compat)
  Manager: 'Manager',
  Accountant: 'Accountant',
  StorageClerk: 'Storage Clerk',
}

export const ENTITY_LABELS: Record<string, string> = {
  FUEL_STATION: 'Fuel Station',
  CONSTRUCTION: 'Construction',
  BOTH: 'Both',
}

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PROBATION: 'Probation',
  FIXED_TERM: 'Fixed-term',
  EXPIRED: 'Expired',
}
