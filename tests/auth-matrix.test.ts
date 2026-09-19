import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { CAPABILITIES, OFFICE_CAPABILITIES, isCapability } from "@/lib/capabilities";
import { POWER_CAPABILITIES } from "@/lib/access-control";
import { GOVERNED_PAGES, pagesForCapabilities } from "@/lib/governance";

/**
 * Authorization matrix.
 *
 * The runtime half of this suite — what a restricted account, a role
 * assignment, an office term or a power grant actually resolves to — lives in
 * `access-control.test.ts`, which drives the real resolver against an
 * in-memory Appwrite. This file covers the half that no request can exercise:
 * the shape of the authority model itself.
 *
 * The model has one rule, and this suite exists to enforce it: **every
 * capability is either checked by a route, or it does not belong in the
 * vocabulary.** A name that is grantable but checked by nothing is worse than a
 * missing feature — an administrator reads the console, ticks the box, and
 * nothing happens, because the console was describing a permission the server
 * has never heard of. That exact failure shipped repeatedly during the
 * role/office/power migration, which is why the check is mechanical now.
 */

const ROOT = process.cwd();
const API_DIR = join(ROOT, "app", "api");

/**
 * Where each capability is enforced, as the file the gate lives in. Kept as
 * literals so a stale entry fails loudly rather than silently passing: the
 * suite opens every file below and requires it to name its capability.
 *
 * `departments.view` is the one deliberate exception and is not enforced by a
 * route at all — see VIEW_ONLY below.
 */
const ENFORCEMENT: Record<string, string> = {
  "blog.create": "app/api/blogs/route.ts",
  "blog.review": "app/api/blogs/route.ts",
  "access.assign_roles": "app/api/access/route.ts",
  "access.manage_role_templates": "app/api/access/route.ts",
  "governance.manage": "app/api/admin/governance/route.ts",
  "governance.manage_offices": "app/api/admin/offices/route.ts",
  "events.create": "app/api/events/route.ts",
  "events.update": "app/api/admin/events/route.ts",
  "events.manage": "app/api/admin/events/route.ts",
  "events.approve": "app/api/admin/events/route.ts",
  "events.publish": "app/api/admin/events/route.ts",
  "registrations.view": "app/api/admin/registrations/route.ts",
  "registrations.manage": "app/api/admin/registrations/route.ts",
  "tickets.view": "app/api/tickets/verify/route.ts",
  "tickets.verify": "app/api/tickets/verify/route.ts",
  "tickets.invalidate": "app/api/tickets/verify/route.ts",
  "membership.view_applications": "app/api/admin/membership/route.ts",
  "users.view": "app/api/admin/users/route.ts",
  "users.update": "app/api/admin/users/route.ts",
  "departments.manage": "app/api/admin/departments/route.ts",
  "designations.assign": "app/api/admin/designations/route.ts",
  "powers.manage": "app/api/admin/powers/route.ts",
  "resources.manage": "app/api/resources/route.ts",
  "resources.approve": "app/api/admin/resources/route.ts",
  "gallery.manage": "app/api/admin/gallery/route.ts",
  "gallery.approve": "app/api/admin/gallery/route.ts",
  "projects.manage": "app/api/admin/projects/route.ts",
  "projects.approve": "app/api/admin/projects/route.ts",
  "sponsors.manage": "app/api/admin/sponsors/route.ts",
  "sponsors.approve": "app/api/admin/sponsors/route.ts",
  "notifications.send": "app/api/notifications/route.ts",
  "audit.view": "app/api/audit/route.ts",
  "security.authorize_activity": "app/api/security/activities/route.ts",
  "security.manage_incidents": "app/api/security/incidents/route.ts",
  "security.contain": "app/api/security/incidents/route.ts",
};

/**
 * Capabilities whose gate is chosen at runtime from the request body — a
 * per-action map or ternary — so the name never appears next to `request`.
 * The file still has to name the capability, and still has to have a dynamic
 * gate to receive it; both are asserted below.
 */
const INDIRECT: Record<string, string> = {
  "blog.approve": "app/api/blogs/route.ts",
  "blog.feature": "app/api/blogs/route.ts",
  "blog.publish": "app/api/blogs/route.ts",
  "membership.approve": "app/api/admin/membership/route.ts",
  "membership.reject": "app/api/admin/membership/route.ts",
};

/**
 * Capabilities with no route gate, and the reason each is allowed to exist
 * without one. Everything here is read *by a payload* to choose a view, never
 * to admit a request — if that stops being true, it belongs in ENFORCEMENT.
 */
const VIEW_ONLY: Record<string, string> = {
  "departments.view":
    "read by /api/dashboard to pick the department view-model; no route admits or refuses on it",
};

/**
 * Names retired from the vocabulary, and why they must not come back without a
 * gate to go with them.
 */
const RETIRED: Record<string, string> = {
  "blog.edit_own": "no author-facing edit path exists; drafting is ownership-checked in the route",
  "blog.submit": "POST /api/blogs already requires blog.create and files the post as pending",
  "blog.request_revision": "no request-revision action and no UI; rejection carries the reason",
  "access.manage_powers": "duplicate of powers.manage, which is what the powers route enforces",
  "users.manage_roles": "the governance tier is granted in /api/admin/users under users.update",
  "registrations.create": "registering is membership-gated by design, not capability-gated",
  "governance.view_records":
    "would need a visibility filter before it could be handed out: /admin/governance serves restricted records",
};

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) found.push(path);
  }
  return found;
}

/** Capability names passed to requireCapability / requireAnyCapability in `source`. */
function gatedNamesIn(source: string): string[] {
  const names: string[] = [];
  // A gate list may choose between two capabilities from the request body
  // (`action === "publish" ? "events.publish" : "events.approve"`). Strip the
  // comparisons first, or the action word reads as a capability name.
  const cleaned = source
    .replace(/[!=]==?\s*"[^"]*"/g, "==")
    .replace(/"[^"]*"\s*[!=]==?/g, "==");
  const call = /require(?:Any)?Capability\(\s*request\s*,\s*(?:\[([^\]]*)\]|"([^"]*)")/g;
  for (const match of cleaned.matchAll(call)) {
    const literalGroup = match[2];
    if (literalGroup) {
      names.push(literalGroup);
      continue;
    }
    for (const quoted of match[1].matchAll(/"([^"]+)"/g)) names.push(quoted[1]);
  }
  return names;
}

const read = (relativePath: string) =>
  readFileSync(join(ROOT, relativePath), "utf8");

describe("vocabulary", () => {
  it("has no duplicate entries", () => {
    const seen = new Set<string>();
    const duplicates = CAPABILITIES.filter((capability) => {
      if (seen.has(capability)) return true;
      seen.add(capability);
      return false;
    });

    expect(duplicates).toEqual([]);
  });

  it("retires names that no route enforces, and keeps them retired", () => {
    for (const [name, reason] of Object.entries(RETIRED)) {
      expect(isCapability(name), `${name} came back: ${reason}`).toBe(false);
    }
  });

  it("gives every capability a home: a route gate or a documented view reader", () => {
    const homeless = CAPABILITIES.filter(
      (capability) =>
        !(capability in ENFORCEMENT) &&
        !(capability in INDIRECT) &&
        !(capability in VIEW_ONLY),
    );

    expect(
      homeless,
      "grantable but enforced nowhere — wire it into a route or drop it from CAPABILITIES",
    ).toEqual([]);
  });
});

describe("enforcement", () => {
  const routeFiles = sourceFiles(API_DIR);

  it("names only real capabilities at its gates", () => {
    const unknown = new Map<string, string>();

    for (const file of routeFiles) {
      for (const name of gatedNamesIn(readFileSync(file, "utf8"))) {
        if (!isCapability(name)) unknown.set(name, relative(ROOT, file));
      }
    }

    expect([...unknown.entries()], "a gate checks a capability the engine cannot resolve").toEqual([]);
  });

  it("actually checks the file it claims to", () => {
    const missing: string[] = [];

    for (const [capability, file] of Object.entries(ENFORCEMENT)) {
      let source: string;
      try {
        source = read(file);
      } catch {
        missing.push(`${capability} -> ${file} (no such file)`);
        continue;
      }
      if (!gatedNamesIn(source).includes(capability)) {
        missing.push(`${capability} -> ${file} (file gates on something else)`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("reaches indirect gates through a real dynamic call", () => {
    const missing: string[] = [];
    // A non-literal second argument: the capability comes from the body.
    const dynamicGate = /require(?:Any)?Capability\(\s*request\s*,\s*[^"[\]]/;

    for (const [capability, file] of Object.entries(INDIRECT)) {
      let source: string;
      try {
        source = read(file);
      } catch {
        missing.push(`${capability} -> ${file} (no such file)`);
        continue;
      }
      if (!source.includes(`"${capability}"`)) {
        missing.push(`${capability} -> ${file} (capability never named)`);
      } else if (!dynamicGate.test(source)) {
        missing.push(`${capability} -> ${file} (named but no dynamic gate)`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("gates the whole vocabulary, so the table cannot silently fall behind", () => {
    const covered = new Set([
      ...Object.keys(ENFORCEMENT),
      ...Object.keys(INDIRECT),
      ...Object.keys(VIEW_ONLY),
    ]);
    const uncovered = CAPABILITIES.filter((capability) => !covered.has(capability));

    expect(uncovered).toEqual([]);
  });
});

describe("grants", () => {
  const officeGrants = Object.entries(OFFICE_CAPABILITIES)
    .map(([office, caps]) => [office, caps] as const);
  const powerGrants = Object.entries(POWER_CAPABILITIES)
    .map(([power, caps]) => [power, caps] as const);

  it("offices grant only real capabilities, without repeats", () => {
    for (const [office, caps] of officeGrants) {
      expect(new Set(caps).size, `${office} lists a capability twice`).toBe(caps.length);
      for (const capability of caps) {
        expect(isCapability(capability), `${office} -> ${capability}`).toBe(true);
      }
    }
  });

  it("powers grant only real capabilities, without repeats", () => {
    for (const [power, caps] of powerGrants) {
      expect(new Set(caps).size, `${power} lists a capability twice`).toBe(caps.length);
      for (const capability of caps) {
        expect(isCapability(capability), `${power} -> ${capability}`).toBe(true);
      }
    }
  });

  it("never hands out a capability that nothing enforces", () => {
    const inert: string[] = [];

    for (const [grant, caps] of [...officeGrants, ...powerGrants]) {
      for (const capability of caps) {
        const enforced = capability in ENFORCEMENT || capability in INDIRECT;
        const readByAPayload = capability in VIEW_ONLY;
        if (!enforced && !readByAPayload) {
          inert.push(`${grant} grants ${capability} (${relative(ROOT, "app/api")} checks nothing)`);
        }
      }
    }

    expect(inert).toEqual([]);
  });
});

describe("governed pages", () => {
  it("advertises only real capabilities", () => {
    for (const page of GOVERNED_PAGES) {
      for (const capability of page.capabilities) {
        expect(isCapability(capability), `${page.href} -> ${capability}`).toBe(true);
      }
    }
  });

  it("shows a wildcard account every page, and a member none", () => {
    expect(pagesForCapabilities(new Set(["*"])).length).toBe(GOVERNED_PAGES.length);
    expect(pagesForCapabilities(new Set(["events.view"])).length).toBe(0);
    expect(pagesForCapabilities(new Set()).length).toBe(0);
  });

  it("points each chartered surface at the capability its route accepts", () => {
    const byHref = new Map(GOVERNED_PAGES.map((page) => [page.href, page.capabilities]));

    // The door list is read via tickets.view (wired into GET /api/tickets/verify);
    // writing a blog is the blog.create screen; access administration is the
    // console's three capabilities.
    expect(byHref.get("/events/[id]/tickets")).toContain("tickets.view");
    expect(byHref.get("/blog/write")).toContain("blog.create");
    expect(byHref.get("/admin/access")).toEqual(
      expect.arrayContaining([
        "access.assign_roles",
        "governance.manage_offices",
        "powers.manage",
      ]),
    );
  });

  it("lists membership review for the office that holds it", () => {
    const pages = pagesForCapabilities(OFFICE_CAPABILITIES.membership_lead);

    expect(pages.some((page) => page.href === "/admin/membership")).toBe(true);
  });
});
