export const SUPERVISOR_EMAILS = [
  'maguicordoba@gmail.com',
  'anacarolinaserrentino@gmail.com',
];

export function esSupervisor(email) {
  if (!email) return false;
  return SUPERVISOR_EMAILS.includes(String(email).trim().toLowerCase());
}
