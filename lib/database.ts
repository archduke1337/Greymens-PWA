// lib/database.ts
import type { Event, Registration, Project } from "@/lib/types";

import { APPWRITE_CONFIG } from "./appwrite";

const {
  databaseId: DATABASE_ID,
  eventsCollectionId: EVENTS_COLLECTION_ID,
  registrationsCollectionId: REGISTRATIONS_COLLECTION_ID,
  projectsCollectionId: PROJECTS_COLLECTION_ID,
  eventImagesBucketId: EVENT_IMAGES_BUCKET_ID,
} = APPWRITE_CONFIG;

export {
  DATABASE_ID,
  EVENTS_COLLECTION_ID,
  REGISTRATIONS_COLLECTION_ID,
  PROJECTS_COLLECTION_ID,
  EVENT_IMAGES_BUCKET_ID,
};

// Re-export types for backward compatibility with existing imports
export type { Event, Registration, Project };

export const COLLECTIONS = {
  EVENTS: EVENTS_COLLECTION_ID,
  REGISTRATIONS: REGISTRATIONS_COLLECTION_ID,
  PROJECTS: PROJECTS_COLLECTION_ID,
  PROFILES: "profiles",
  APPLICATIONS: "applications",
  MEMBERSHIPS: "memberships",
  DEPARTMENTS: "departments",
  USER_DEPARTMENTS: "user_departments",
  DESIGNATIONS: "designations",
  USER_DESIGNATIONS: "user_designations",
  POWERS: "powers",
  USER_POWERS: "user_powers",
  TICKETS: "tickets",
  TICKET_VERIFICATIONS: "ticket_verifications",
  RESOURCES: "resources",
  NOTIFICATIONS: "notifications",
  AUDIT_LOGS: "audit_logs",
  APPROVAL_WORKFLOWS: "approval_workflows",
  AUTHORIZED_ACTIVITIES: "authorized_activities",
  INCIDENT_REPORTS: "incident_reports",
  GOVERNANCE_RECORDS: "governance_records",
  OFFICE_ASSIGNMENTS: "office_assignments",
  GALLERY: "gallery",
  EVENT_TYPES: "event_types",
  EVENT_TYPE_DATA: "event_type_data",
  BLOGS: "blogs",
  ROLE_TEMPLATES: "role_templates",
  ROLE_ASSIGNMENTS: "role_assignments",
  USER_ROLES: "user_roles",
  SPONSORS: "sponsors",
} as const;
