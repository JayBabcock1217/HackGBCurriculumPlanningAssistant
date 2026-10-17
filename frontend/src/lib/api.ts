const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function getBackendStatus() {
  const res = await fetch(`${API_URL}/api/health`, {
    next: { revalidate: 10 },
  });
  if (!res.ok) {
    throw new Error('Backend unavailable');
  }
  return res.json();
}
