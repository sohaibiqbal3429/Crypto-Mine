import { useCallback, useEffect, useRef, useState } from "react"

type Fetcher<Data> = (key: string) => Promise<Data>

type SWROptions = {
  revalidateOnFocus?: boolean
}

type SWRResponse<Data, Error> = {
  data: Data | undefined
  error: Error | undefined
  isLoading: boolean
  isValidating: boolean
  mutate: (data?: Data | Promise<Data>, shouldRevalidate?: boolean) => Promise<Data | undefined>
}

const dataCache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)
  return () => {
    const current = listeners.get(key)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) {
      listeners.delete(key)
    }
  }
}

function notify(key: string) {
  const set = listeners.get(key)
  if (!set) return
  for (const listener of set) {
    listener()
  }
}

function isKey(value: string | null): value is string {
  return typeof value === "string" && value.length > 0
}

export default function useSWR<Data = any, Error = any>(
  key: string | null,
  fetcher?: Fetcher<Data>,
  options: SWROptions = {},
): SWRResponse<Data, Error> {
  const initialData = isKey(key) && dataCache.has(key) ? (dataCache.get(key) as Data) : undefined
  const [data, setData] = useState<Data | undefined>(initialData)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [isLoading, setIsLoading] = useState<boolean>(isKey(key) && !dataCache.has(key))
  const [isValidating, setIsValidating] = useState<boolean>(false)

  const keyRef = useRef(key)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    keyRef.current = key
  }, [key])

  const runFetch = useCallback(
    async (currentKey: string, force = false) => {
      if (!fetcher) {
        return dataCache.get(currentKey) as Data | undefined
      }

      setIsValidating(true)
      setIsLoading(force || !dataCache.has(currentKey))

      try {
        if (!dataCache.has(currentKey) || force) {
          const result = await fetcher(currentKey)
          dataCache.set(currentKey, result)
          notify(currentKey)
          if (mountedRef.current && keyRef.current === currentKey) {
            setData(result)
            setError(undefined)
          }
          return result
        }

        const cached = dataCache.get(currentKey) as Data | undefined
        if (mountedRef.current && keyRef.current === currentKey) {
          setData(cached)
          setError(undefined)
        }
        return cached
      } catch (err) {
        if (mountedRef.current && keyRef.current === currentKey) {
          setError(err as Error)
        }
        throw err
      } finally {
        if (mountedRef.current && keyRef.current === currentKey) {
          setIsLoading(false)
          setIsValidating(false)
        }
      }
    },
    [fetcher],
  )

  useEffect(() => {
    if (!isKey(key)) {
      setData(undefined)
      setError(undefined)
      setIsLoading(false)
      setIsValidating(false)
      return
    }

    const unsubscribe = subscribe(key, () => {
      if (!mountedRef.current || keyRef.current !== key) {
        return
      }
      if (dataCache.has(key)) {
        setData(dataCache.get(key) as Data)
      }
    })

    void runFetch(key)

    return () => {
      unsubscribe()
    }
  }, [key, runFetch])

  useEffect(() => {
    if (!options.revalidateOnFocus || !isKey(key)) {
      return
    }

    const handler = () => {
      void runFetch(key, true)
    }

    window.addEventListener("focus", handler)
    return () => {
      window.removeEventListener("focus", handler)
    }
  }, [key, options.revalidateOnFocus, runFetch])

  const mutate = useCallback(
    async (newData?: Data | Promise<Data>, shouldRevalidate = true) => {
      if (!isKey(key)) {
        return undefined
      }

      if (typeof newData !== "undefined") {
        const resolved = await Promise.resolve(newData)
        dataCache.set(key, resolved)
        notify(key)
        if (mountedRef.current && keyRef.current === key) {
          setData(resolved)
          setError(undefined)
          setIsLoading(false)
          setIsValidating(false)
        }
        if (!shouldRevalidate) {
          return resolved
        }
      }

      return runFetch(key, true)
    },
    [key, runFetch],
  )

  return { data, error, isLoading, isValidating, mutate }
}
