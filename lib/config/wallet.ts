import { getPublicWalletAddresses } from "@/lib/services/app-settings"

export interface DepositWalletOption {
  id: string
  label: string
  network: string
  address: string
}

export async function getDepositWalletOptions(): Promise<DepositWalletOption[]> {
  const wallets = await getPublicWalletAddresses()
  return wallets.map((wallet) => ({
    id: wallet.id,
    label: wallet.label,
    network: wallet.network,
    address: wallet.address,
  }))
}

export async function getDepositWalletOptionMap(): Promise<Record<string, DepositWalletOption>> {
  const options = await getDepositWalletOptions()
  return options.reduce<Record<string, DepositWalletOption>>((acc, option) => {
    acc[option.id] = option
    return acc
  }, {})
}
