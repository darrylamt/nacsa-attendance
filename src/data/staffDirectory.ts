// Demo staff directory — replace with API or local DB when backend is ready
export interface StaffDirectoryEntry {
  id: string;
  name: string;
  department: string;
}

export const STAFF_DIRECTORY: StaffDirectoryEntry[] = [
  { id: '100001', name: 'Ama Asante', department: 'Operations' },
  { id: '100002', name: 'Kofi Mensah', department: 'IT' },
  { id: '100003', name: 'Abena Osei', department: 'Finance' },
  { id: '100004', name: 'Kweku Boateng', department: 'HR' },
  { id: '100005', name: 'Adwoa Darkwah', department: 'Administration' },
  { id: '100006', name: 'Yaw Amoah', department: 'Security' },
  { id: '100007', name: 'Efua Bonsu', department: 'Communications' },
  { id: '100008', name: 'Nana Appiah', department: 'Legal' },
];

export function lookupStaff(id: string): StaffDirectoryEntry | null {
  return STAFF_DIRECTORY.find((s) => s.id === id) ?? null;
}
