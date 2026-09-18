import type { LetterData } from "./types";

/**
 * Notification letter templates.
 *
 * These are pure formatting helpers with no network access, kept in their own
 * dependency-free module so that server routes can render a letter without
 * importing `lib/notifications.ts` (which is written around `fetch` and is
 * meant for the browser).
 */

export function welcomeLetter(data: {
  name: string;
  membershipId: string;
  department?: string;
}): LetterData {
  return {
    template: "welcome",
    subject: "Welcome to the club",
    body: `Dear ${data.name},\n\nYour membership application has been approved.\n\nMembership ID: ${data.membershipId}\n${data.department ? `Department: ${data.department}\n` : ""}Date of approval: ${new Date().toLocaleDateString()}\n\nYou now have access to member-only events and workshops, department resources, and the club community.\n\nWelcome aboard.`,
    metadata: { membershipId: data.membershipId, department: data.department },
  };
}

export function promotionLetter(data: {
  name: string;
  oldRole: string;
  newDesignation: string;
  approvedBy: string;
}): LetterData {
  return {
    template: "promotion",
    subject: `Promotion to ${data.newDesignation}`,
    body: `Dear ${data.name},\n\nYou have been promoted to ${data.newDesignation}.\n\nPrevious role: ${data.oldRole}\nNew role: ${data.newDesignation}\nEffective date: ${new Date().toLocaleDateString()}\nApproved by: ${data.approvedBy}\n\nCongratulations.`,
    metadata: {
      newDesignation: data.newDesignation,
      approvedBy: data.approvedBy,
    },
  };
}

export function designationLetter(data: {
  name: string;
  designation: string;
  assignedBy: string;
}): LetterData {
  return {
    template: "designation",
    subject: `Designation assigned: ${data.designation}`,
    body: `Dear ${data.name},\n\nYou have been assigned the designation ${data.designation}.\n\nAssigned by: ${data.assignedBy}\nDate: ${new Date().toLocaleDateString()}`,
    metadata: { designation: data.designation, assignedBy: data.assignedBy },
  };
}
