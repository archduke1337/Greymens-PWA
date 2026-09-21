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
    subject: "Congratulations — welcome to Greymens",
    body: `Hi ${data.name},\n\nCongratulations — you're officially a Greymen.\n\nWe don't hand that out lightly. This club runs on its members: every workshop taught, every late-night CTF, every project on the shelf exists because members showed up and did the work. You earned your place among them, and we're proud to have you. Wear it well.\n\nMembership number: ${data.membershipId}\n${data.department ? `Starting in: ${data.department}\n` : ""}Approved: ${new Date().toLocaleDateString()}\n\nWhat now: come to the next session (see Events), join the Discord, and introduce yourself${data.department ? ` in the ${data.department} channel` : ""}. Member workshops, resources, and CTF teams are open to you from here.\n\nThis is your club now. Build something great with it.\n\nWith respect,\nTeam Greymens`,
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
