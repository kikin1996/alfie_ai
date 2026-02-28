export type ViewingStatus = "pending" | "sms_sent" | "confirmed" | "cancelled"

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
  createdAt: string
  updatedAt: string
  userId: string
}

export interface UserSettings {
  id: string
  userId: string
  triggerKeyword: string
  twilioAccountSid: string | null
  twilioAuthToken: string | null
  twilioPhoneNumber: string | null
  smsTemplate: string
  smsHoursBefore: number
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
