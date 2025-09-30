export interface DepositWalletOption {
  id: string
  label: string
  network: string
  address: string
}

const RAW_OPTIONS = [
  {
    id: "bep20_primary",
    label: "BEP20 (Address 1)",
    network: "BEP20",
    envKeys: ["DEPOSIT_WALLET_ADRESS_1", "DEPOSIT_WALLET_ADDRESS_1"],
  },
  {
    id: "bep20_secondary",
    label: "BEP20 (Address 2)",
    network: "BEP20",
    envKeys: ["DEPOSIT_WALLET_ADRESS_2", "DEPOSIT_WALLET_ADDRESS_2"],
  },
  {
    id: "trc20",
    label: "TRC20",
    network: "TRC20",
    envKeys: ["DEPOSIT_WALLET_ADRESS_3", "DEPOSIT_WALLET_ADDRESS_3"],
  },
] as const

function resolveAddress(envKeys: readonly string[]): string {
  for (const key of envKeys) {
    const value = process.env[key]
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ""
}

export function getDepositWalletOptions(): DepositWalletOption[] {
  return RAW_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    network: option.network,
    address: resolveAddress(option.envKeys),
  })).filter((option) => option.address)
}

export function getDepositWalletOptionMap(): Record<string, DepositWalletOption> {
  const options = getDepositWalletOptions()
  return options.reduce<Record<string, DepositWalletOption>>((acc, option) => {
    acc[option.id] = option
    return acc
  }, {})
}
