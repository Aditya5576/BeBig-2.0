export function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    const emailPrefix = email.trim().split('@')[0];
    return emailPrefix.slice(0, 2).toUpperCase();
  }
  return 'BB';
}
