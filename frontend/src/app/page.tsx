import { getBackendStatus } from '@/lib/api';

export default async function Home() {
  let status: { status: string } | null = null;
  try {
    status = await getBackendStatus();
  } catch {
    status = null;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">
        HackGB Curriculum Assistant
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Assisting teachers in developing personalized curricula
      </p>

      <div className="bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-lg font-semibold mb-2">Backend Status</h2>
        {status ? (
          <p className="text-green-600">
            Connected - {status.status}
          </p>
        ) : (
          <p className="text-red-600">Not available</p>
        )}
      </div>
    </main>
  );
}
