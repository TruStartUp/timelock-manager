import { useQuery } from '@tanstack/react-query'

async function fetchAiEnabled(signal?: AbortSignal): Promise<boolean> {
  const res = await fetch('/api/explain_operation', { method: 'GET', signal })
  if (!res.ok) return false
  const data = (await res.json()) as { enabled?: boolean }
  return Boolean(data.enabled)
}

export function useAiEnabled() {
  const query = useQuery({
    queryKey: ['ai-enabled'],
    queryFn: ({ signal }) => fetchAiEnabled(signal),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  })

  return {
    aiEnabled: query.data ?? false,
    isLoading: query.isLoading,
  }
}
