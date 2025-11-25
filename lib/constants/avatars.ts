export interface ProfileAvatarOption {
  value: string
  label: string
  alt: string
}

export const PROFILE_AVATAR_OPTIONS: ProfileAvatarOption[] = [
  { value: "avatar-01", label: "Visionary", alt: "Avatar of a confident person with short hair in a blue gradient circle" },
  { value: "avatar-02", label: "Strategist", alt: "Avatar of a person with a ponytail wearing a teal jacket" },
  { value: "avatar-03", label: "Navigator", alt: "Avatar of a smiling person with short curls in an orange gradient" },
  { value: "avatar-04", label: "Innovator", alt: "Avatar of a person with glasses and purple tones" },
  { value: "avatar-05", label: "Guardian", alt: "Avatar of a person with braids and a warm sunset gradient" },
  { value: "avatar-06", label: "Trailblazer", alt: "Avatar of a focused person in a cool violet gradient" },
]

export const PROFILE_AVATAR_VALUES = PROFILE_AVATAR_OPTIONS.map((option) => option.value)
