export function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsdc(raw: bigint): string {
  // USDC has 6 decimals.
  const value = Number(raw) / 1_000_000;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
