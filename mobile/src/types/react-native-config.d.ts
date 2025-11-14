declare module 'react-native-config' {
  interface NativeConfig {
    API_BASE_URL?: string
    REALTIME_REFETCH_INTERVAL_MS?: string
  }

  const Config: NativeConfig
  export default Config
}
