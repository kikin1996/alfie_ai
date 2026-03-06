export type ViewingStatus = "pending" | "sms_sent" | "confirmed" | "cancelled"

export interface ExtraNotification {
  id: string
  type: "sms" | "vapi"
  minutesBefore: number
  label: string
  sent: boolean
  enabled: boolean
}

export interface Viewing {
  id: string
  calendarEventId: string
  address: string
  clientPhone: string
  clientName: string
  eventStart: string
  eventEnd?: string
  status: ViewingStatus
  smsSentAt?: string
  confirmedAt?: string
  sms2hSent: boolean
  sms1hSent: boolean
  vapiCalled: boolean
  sms2hEnabled: boolean
  sms1hEnabled: boolean
  vapiEnabled: boolean
  extraNotifications: ExtraNotification[]
  createdAt: string
  updatedAt: string
  userId: string
}

export interface UserSettings {
  id: string
  userId: string
  triggerKeyword: string
  smsTemplate: string
  smsbranaLogin: string | null
  smsbranaPassword: string | null
  whatsappPhone: string | null
  whatsappApikey: string | null
  vapiApiKey: string | null
  vapiAssistantId: string | null
  vapiPhoneNumberId: string | null
  createdAt: string
  updatedAt: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  priceCzk: number
  creditsPerMonth: number
  description: string
  sortOrder: number
}

export interface UserSubscription {
  id: string
  userId: string
  planId: string
  plan?: SubscriptionPlan
  creditsRemaining: number
  periodStart: string
  periodEnd: string
  status: "active" | "cancelled" | "expired"
  createdAt: string
  updatedAt: string
}

export interface ParsedCalendarEvent {
  id: string
  summary: string
  description: string
  location: string
  start: string
  end: string
  address: string
  clientPhone: string
  clientName: string
}
