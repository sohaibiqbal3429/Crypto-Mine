"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  Copy,
  CheckCircle,
  Loader2,
  Link2,
} from "lucide-react"

import type { SerializableUser } from "@/lib/serializers/user"
import { formatPhoneDisplay } from "@/lib/utils/formatting"
import { PROFILE_AVATAR_OPTIONS } from "@/lib/constants/avatars"
import { ACTIVE_DEPOSIT_THRESHOLD } from "@/lib/constants/bonuses"
import { formatOTPSuccessMessage, type OTPSuccessPayload } from "@/lib/utils/otp-messages"

type StatusMessage = { success?: string; error?: string }

// --- helpers (defensive) ---
const toNumber = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined) return fallback
  if (typeof v === "number") return v
  const n = Number((v as any).toString?.() ?? v)
  return Number.isFinite(n) ? n : fallback
}
const usd = (v: unknown) => `$${toNumber(v).toFixed(2)}`
const dateISOToLocal = (v?: string | Date | null) => {
  if (!v) return ""
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString()
}

export default function ProfilePage() {
  const [user, setUser] = useState<SerializableUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [globalError, setGlobalError] = useState("")
  const [profileStatus, setProfileStatus] = useState<StatusMessage>({})
  const [verificationStatus, setVerificationStatus] = useState<StatusMessage>({})
  const [passwordStatus, setPasswordStatus] = useState<StatusMessage>({})
  const [otpStatus, setOtpStatus] = useState<StatusMessage>({})
  const [profileLoading, setProfileLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const router = useRouter()

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    avatar: PROFILE_AVATAR_OPTIONS[0]?.value ?? "avatar-01",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    otpCode: "",
  })

  const syncUserState = (nextUser: SerializableUser) => {
    setUser(nextUser)
    setProfileData({
      name: nextUser.name || "",
      email: nextUser.email || "",
      phone: nextUser.phone || "",
      avatar: nextUser.profileAvatar || PROFILE_AVATAR_OPTIONS[0]?.value || "avatar-01",
    })
  }

  const selectedAvatar = user?.profileAvatar || PROFILE_AVATAR_OPTIONS[0]?.value || "avatar-01"
  const isBlocked = Boolean(user?.isBlocked)
  const isActiveAccount = Boolean(user?.isActive)
  const lifetimeDeposits = toNumber(user?.depositTotal)
  const threshold = toNumber(ACTIVE_DEPOSIT_THRESHOLD, 80)
  const remainingToActivate = Math.max(0, threshold - lifetimeDeposits)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch("/api/auth/me")
        if (!userRes.ok) {
          setGlobalError("Failed to load user data")
          return
        }
        const response = await userRes.json()
        const fetchedUser: SerializableUser | null = response.user || null
        if (fetchedUser) {
          syncUserState(fetchedUser)
        } else {
          setGlobalError("Failed to load user data")
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
        setGlobalError("Failed to load user data")
      } finally {
        setLoading(false)
      }
    }

    fetchData().catch((error) => {
      console.error("Unexpected fetch error:", error)
      setGlobalError("Failed to load user data")
      setLoading(false)
    })
  }, [])

  const handleProfileUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileLoading(true)
    setProfileStatus({})
    setGlobalError("")

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone,
          avatar: profileData.avatar,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || "Failed to update profile")
      if (data.user) syncUserState(data.user as SerializableUser)

      setProfileStatus({ success: data.message || "Profile updated successfully." })
      setVerificationStatus({})
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Failed to update profile"
      setProfileStatus({ error: message })
    } finally {
      setProfileLoading(false)
    }
  }

  const handleVerifyProfile = async () => {
    setVerificationStatus({})
    setGlobalError("")

    if (!user?.phone) {
      setVerificationStatus({ error: "Add a phone number to your profile before verifying." })
      return
    }

    setVerifyLoading(true)
    try {
      const response = await fetch("/api/profile/verify", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || "Failed to verify profile")
      if (data.user) syncUserState(data.user as SerializableUser)
      setVerificationStatus({ success: data.message || "Profile verified successfully." })
      setProfileStatus({})
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Failed to verify profile"
      setVerificationStatus({ error: message })
    } finally {
      setVerifyLoading(false)
    }
  }

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordStatus({ error: "New passwords do not match" })
      return
    }
    if (!passwordData.otpCode) {
      setPasswordStatus({ error: "Enter the 6-digit verification code we emailed you" })
      return
    }

    setPasswordLoading(true)
    setPasswordStatus({})
    setOtpStatus({})
    setGlobalError("")

    try {
      const response = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          otpCode: passwordData.otpCode,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || "Failed to update password")

      setPasswordStatus({ success: data.message || "Password updated successfully." })
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "", otpCode: "" })
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Failed to update password"
      setPasswordStatus({ error: message })
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleSendPasswordOtp = async () => {
    if (!profileData.email) {
      setOtpStatus({ error: "Add an email address to your profile before requesting a code" })
      return
    }

    setOtpLoading(true)
    setOtpStatus({})
    setPasswordStatus({})

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileData.email, purpose: "password_reset" }),
      })
      const data = (await response.json().catch(() => ({}))) as OTPSuccessPayload & {
        error?: string
        message?: string
      }
      if (!response.ok) throw new Error(data.message || data.error || "Failed to send verification code")
      setOtpStatus({ success: formatOTPSuccessMessage(data, "Verification code sent to your email.") })
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Failed to send verification code"
      setOtpStatus({ error: message })
    } finally {
      setOtpLoading(false)
    }
  }

  const buildAuthUrl = (referralCode: string) => {
    const AUTH_PATH = "/auth/register"
    const url = new URL(AUTH_PATH, window.location.origin)
    url.searchParams.set("ref", referralCode)
    return url.toString()
  }

  const copyReferralLink = async () => {
    if (!user?.referralCode) {
      setGlobalError("No referral code available")
      return
    }

    setIsGeneratingLink(true)
    setGlobalError("")
    try {
      const referralCode = String(user.referralCode).trim()
      const referralLink = buildAuthUrl(referralCode)
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
      // Optional: navigate user to the signup page they just copied
      router.push(referralLink)
    } catch (error) {
      console.error("Error generating/copying referral link:", error)
      setGlobalError("Failed to copy or open the referral link")
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const copyReferralCode = async () => {
    if (user?.referralCode) {
      try {
        await navigator.clipboard.writeText(user.referralCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error("Failed to copy to clipboard:", error)
        setGlobalError("Failed to copy referral code")
      }
    } else {
      setGlobalError("No referral code available")
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user ?? undefined} />

      <main className="flex-1 overflow-auto md:ml-64">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance">Profile Settings</h1>
            <p className="text-muted-foreground">Manage your account information and security</p>
          </div>

          {globalError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}

          {isBlocked && (
            <Alert className="mb-6 border-orange-200 bg-orange-50 text-orange-900">
              <AlertDescription>
                Your account is currently blocked. Contact support for assistance before requesting deposits or withdrawals.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center">
                  <Image
                    src={`/avatars/${selectedAvatar}.svg`}
                    alt="Current profile avatar"
                    width={96}
                    height={96}
                    className="h-24 w-24 rounded-full border-4 border-background shadow-lg"
                  />
                </div>
                <CardTitle>{user?.name}</CardTitle>
                <CardDescription>{user?.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Badge variant={isActiveAccount ? "default" : "outline"}>
                      {isActiveAccount ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="secondary">Level {user?.level || 1}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Lifetime deposits: {usd(lifetimeDeposits)} / {usd(threshold)}
                    {!isActiveAccount && remainingToActivate > 0
                      ? ` • Deposit ${usd(remainingToActivate)} more to activate`
                      : ""}
                  </div>
                  {isBlocked && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Badge variant="destructive">Blocked</Badge>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Member since {dateISOToLocal(user?.createdAt ?? undefined)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Referral Code</Label>
                  <div className="flex gap-2">
                    <Input value={user?.referralCode || ""} readOnly className="font-mono" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyReferralCode}
                      disabled={!user?.referralCode}
                      title="Copy referral code"
                    >
                      {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyReferralLink}
                      disabled={!user?.referralCode || isGeneratingLink}
                      title="Copy & open signup link"
                    >
                      {isGeneratingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <div className="font-semibold">{usd(user?.depositTotal)}</div>
                    <div className="text-muted-foreground">Total Deposits</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <div className="font-semibold">{usd(user?.withdrawTotal)}</div>
                    <div className="text-muted-foreground">Total Withdrawals</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Phone Verification</Label>
                  <div className="rounded-lg border border-dashed border-muted-foreground/40 p-3">
                    {user?.phone && user.phoneVerified ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{formatPhoneDisplay(user.phone)}</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Verified
                        </Badge>
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="font-medium">Phone verification pending</p>
                        <p>
                          {user?.phone
                            ? "Verify your phone number to secure your account and complete profile verification."
                            : "Add a phone number to enable verification and security alerts."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="security" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Security
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Profile Verification
                        </CardTitle>
                        <CardDescription>
                          Add and verify your phone number to secure your account and unlock all profile features.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-muted p-4">
                            <p className="text-sm font-semibold text-muted-foreground">Phone</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-base font-semibold text-foreground">
                                {user?.phoneVerified ? "Verified" : "Not verified"}
                              </span>
                              <Badge
                                variant={user?.phoneVerified ? "secondary" : "outline"}
                                className={user?.phoneVerified ? "bg-green-100 text-green-800" : undefined}
                              >
                                {user?.phoneVerified ? "Verified" : "Pending"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {verificationStatus.error && (
                          <Alert variant="destructive">
                            <AlertDescription>{verificationStatus.error}</AlertDescription>
                          </Alert>
                        )}

                        {verificationStatus.success && (
                          <Alert className="border-green-200 bg-green-50 text-green-800">
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>{verificationStatus.success}</AlertDescription>
                          </Alert>
                        )}

                        <Button onClick={handleVerifyProfile} disabled={verifyLoading || Boolean(user?.phoneVerified)}>
                          {verifyLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : user?.phoneVerified ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Profile Verified
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 h-4 w-4" />
                              Verify Profile
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>Update your personal information</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {profileStatus.error && (
                          <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{profileStatus.error}</AlertDescription>
                          </Alert>
                        )}

                        {profileStatus.success && (
                          <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>{profileStatus.success}</AlertDescription>
                          </Alert>
                        )}

                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                              id="name"
                              value={profileData.name}
                              onChange={(event) => setProfileData((prev) => ({ ...prev, name: event.target.value }))}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Profile Avatar</Label>
                            <RadioGroup
                              value={profileData.avatar}
                              onValueChange={(value) => setProfileData((prev) => ({ ...prev, avatar: value }))}
                              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
                            >
                              {PROFILE_AVATAR_OPTIONS.map((option) => {
                                const isSelected = profileData.avatar === option.value
                                return (
                                  <Label
                                    key={option.value}
                                    htmlFor={`avatar-${option.value}`}
                                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-xs transition focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40 ${
                                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-muted"
                                    }`}
                                  >
                                    <RadioGroupItem id={`avatar-${option.value}`} value={option.value} className="sr-only" />
                                    <Image
                                      src={`/avatars/${option.value}.svg`}
                                      alt={option.alt}
                                      width={72}
                                      height={72}
                                      className="h-16 w-16 rounded-full border border-border bg-background"
                                    />
                                    <span className="font-medium text-foreground">{option.label}</span>
                                  </Label>
                                )
                              })}
                            </RadioGroup>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <Input id="email" type="email" value={profileData.email} readOnly />
                              {user?.emailVerified && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  Verified
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <Input
                                id="phone"
                                type="tel"
                                inputMode="tel"
                                placeholder="+15551234567"
                                pattern="^\\+[1-9]\\d{7,14}$"
                                title="Enter a valid phone number with country code (e.g. +15551234567)"
                                value={profileData.phone}
                                onChange={(event) => setProfileData((prev) => ({ ...prev, phone: event.target.value }))}
                                required
                              />
                              {user?.phoneVerified && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">Use international format, including country code.</p>
                          </div>

                          <Button type="submit" disabled={profileLoading}>
                            {profileLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              "Update Profile"
                            )}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="security">
                  <Card>
                    <CardHeader>
                      <CardTitle>Change Password</CardTitle>
                      <CardDescription>Update your account password</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {otpStatus.error && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertDescription>{otpStatus.error}</AlertDescription>
                        </Alert>
                      )}

                      {otpStatus.success && (
                        <Alert className="mb-4 border-blue-200 bg-blue-50 text-blue-900">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>{otpStatus.success}</AlertDescription>
                        </Alert>
                      )}

                      {passwordStatus.error && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertDescription>{passwordStatus.error}</AlertDescription>
                        </Alert>
                      )}

                      {passwordStatus.success && (
                        <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>{passwordStatus.success}</AlertDescription>
                        </Alert>
                      )}

                      <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword">Current Password</Label>
                          <PasswordInput
                            id="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={(event) =>
                              setPasswordData((prev) => ({ ...prev, currentPassword: event.target.value }))
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newPassword">New Password</Label>
                          <PasswordInput
                            id="newPassword"
                            value={passwordData.newPassword}
                            onChange={(event) =>
                              setPasswordData((prev) => ({ ...prev, newPassword: event.target.value }))
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirm New Password</Label>
                          <PasswordInput
                            id="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={(event) =>
                              setPasswordData((prev) => ({ ...prev, confirmPassword: event.target.value }))
                            }
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="otpCode">Email Verification Code</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleSendPasswordOtp}
                              disabled={otpLoading}
                            >
                              {otpLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                  Sending
                                </>
                              ) : (
                                "Send Code"
                              )}
                            </Button>
                          </div>
                          <Input
                            id="otpCode"
                            type="text"
                            inputMode="numeric"
                            pattern="^\\d{6}$"
                            maxLength={6}
                            placeholder="123456"
                            value={passwordData.otpCode}
                            onChange={(event) =>
                              setPasswordData((prev) => ({ ...prev, otpCode: event.target.value.replace(/[^0-9]/g, "") }))
                            }
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            We&apos;ll email a 6-digit code to confirm this security change.
                          </p>
                        </div>

                        <Button type="submit" disabled={passwordLoading}>
                          {passwordLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Key className="mr-2 h-4 w-4" />
                              Update Password
                            </>
                          )}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
