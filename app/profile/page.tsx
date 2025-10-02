"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Mail, Phone, Shield, Key, Copy, CheckCircle, Loader2, Link2 } from "lucide-react"
// Removed: import Link from "next/link"  // Not needed here

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user data from /api/auth/me
        const userRes = await fetch("/api/auth/me")
        let userData = null
        
        if (userRes.ok) {
          const response = await userRes.json()
          userData = response.user || response
          console.log("User data from /api/auth/me:", userData)
        } else {
          console.error("Failed to fetch from /api/auth/me:", userRes.status)
        }

        // If referralCode is missing, try to fetch from /api/profile/generate-link
        if (userData && !userData.referralCode) {
          try {
            const profileRes = await fetch("/api/profile/generate-link")
            if (profileRes.ok) {
              const profileResponse = await profileRes.json()
              const profileUser = profileResponse.user || profileResponse
              console.log("Profile data from /api/profile/generate-link:", profileUser)
              
              // Merge the referralCode if it exists
              if (profileUser.referralCode) {
                userData.referralCode = profileUser.referralCode
              }
            }
          } catch (profileError) {
            console.error("Failed to fetch from /api/profile/generate-link:", profileError)
          }
        }

        if (userData) {
          setUser(userData)
          setProfileData({
            name: userData.name || "",
            email: userData.email || "",
            phone: userData.phone || "",
          })
        } else {
          setError("Failed to load user data")
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
        setError("Failed to load user data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    setError("")
    setSuccess("")

    try {
      // In real app, this would call API to update profile
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call

      setSuccess("Profile updated successfully!")
    } catch (err) {
      setError("Failed to update profile. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match")
      return
    }

    setIsUpdating(true)
    setError("")
    setSuccess("")

    try {
      // In real app, this would call API to update password
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call

      setSuccess("Password updated successfully!")
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (err) {
      setError("Failed to update password. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  // Helper to build the auth URL with the ?ref= code.
  // Change AUTH_PATH or the query key if your auth route expects something else (e.g., '/auth/login' or 'referral').
  const buildAuthUrl = (referralCode: string) => {
    const AUTH_PATH = "/auth/register" // <-- adjust to '/auth/login' or '/signup' if needed
    const url = new URL(AUTH_PATH, window.location.origin)
    url.searchParams.set("ref", referralCode) // or 'referral' based on your backend
    return url.toString()
  }

  const copyReferralLink = async () => {
    if (!user?.referralCode) {
      setError("No referral code available")
      return
    }

    setIsGeneratingLink(true)
    setError("")

    try {
      const referralCode = String(user.referralCode).trim()
      const referralLink = buildAuthUrl(referralCode)

      // Copy to clipboard
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)

      // Redirect to auth page with referral pre-filled
      router.push(referralLink)
    } catch (err) {
      console.error("Error generating/copying referral link:", err)
      setError("Failed to copy or open the referral link")
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
        setError("Failed to copy referral code")
      }
    } else {
      setError("No referral code available")
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
      <Sidebar user={user} />

      <main className="flex-1 md:ml-64 overflow-auto">
        <div className="p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-balance">Profile Settings</h1>
            <p className="text-muted-foreground">Manage your account information and security</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Overview */}
            <Card className="lg:col-span-1">
              <CardHeader className="text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mb-4">
                  <User className="w-10 h-10 text-white" />
                </div>
                <CardTitle>{user?.name}</CardTitle>
                <CardDescription>{user?.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-2">
                    Level {user?.level || 1}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
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
                      {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    
                    {/* Copy & open referral link button */}
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={copyReferralLink}
                      disabled={!user?.referralCode || isGeneratingLink}
                      title="Copy & open signup link"
                    >
                      {isGeneratingLink ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="font-semibold">${user?.depositTotal || 0}</div>
                    <div className="text-muted-foreground">Total Deposits</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="font-semibold">${user?.withdrawTotal || 0}</div>
                    <div className="text-muted-foreground">Total Withdrawals</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Settings Tabs */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Profile
                  </TabsTrigger>
                  <TabsTrigger value="security" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Security
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                  <Card>
                    <CardHeader>
                      <CardTitle>Profile Information</CardTitle>
                      <CardDescription>Update your personal information</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {error && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      {success && (
                        <Alert className="border-green-200 bg-green-50 text-green-800 mb-4">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>{success}</AlertDescription>
                        </Alert>
                      )}

                      <form onSubmit={handleProfileUpdate} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            value={profileData.name}
                            onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <Input
                              id="email"
                              type="email"
                              value={profileData.email}
                              onChange={(e) => setProfileData((prev) => ({ ...prev, email: e.target.value }))}
                              required
                            />
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
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <Input
                              id="phone"
                              type="tel"
                              value={profileData.phone}
                              onChange={(e) => setProfileData((prev) => ({ ...prev, phone: e.target.value }))}
                              placeholder="+92xxxxxxxxxx"
                            />
                            {user?.phoneVerified && (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                Verified
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button type="submit" disabled={isUpdating}>
                          {isUpdating ? (
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
                </TabsContent>

                <TabsContent value="security">
                  <Card>
                    <CardHeader>
                      <CardTitle>Change Password</CardTitle>
                      <CardDescription>Update your account password</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword">Current Password</Label>
                          <Input
                            id="currentPassword"
                            type="password"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData((prev) => ({ ...prev, currentPassword: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newPassword">New Password</Label>
                          <Input
                            id="newPassword"
                            type="password"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirm New Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                            required
                          />
                        </div>

                        <Button type="submit" disabled={isUpdating}>
                          {isUpdating ? (
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
