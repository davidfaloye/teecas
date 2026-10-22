// Nigerian phone numbers, as customers type them: 0803 123 4567, 234803…, +234 803 123 4567.

export function validPhone(p) {
  const d = String(p || '').replace(/[^\d]/g, '');
  return (d.length === 11 && d.startsWith('0')) || (d.length === 13 && d.startsWith('234')) || (d.length >= 10 && d.length <= 15 && String(p).trim().startsWith('+'));
}

// 2348031234567 (as the server stores it) → 0803 123 4567. Other numbers come back as +digits.
export function localPhone(p) {
  const d = String(p || '').replace(/[^\d]/g, '');
  if (d.length === 13 && d.startsWith('234')) {
    const n = '0' + d.slice(3);
    return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  }
  return d ? '+' + d : '';
}
