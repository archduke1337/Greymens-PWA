"use client";

import { Avatar, Card, Chip } from "@heroui/react";
import { ExternalLinkIcon, Globe } from "lucide-react";

import { GithubIcon } from "@/components/icons";
import { DynamicIcon } from "@/components/ui/DynamicIcon";

export interface TeamMember {
  userId: string;
  name: string;
  avatar?: string;
  bio?: string;
  skills: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
}

export interface TeamGroup {
  designation: string;
  slug: string;
  badgeIcon?: string;
  members: TeamMember[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

type SocialLink = {
  href: string;
  label: string;
  Icon: React.FC<{ className?: string }>;
};

function socialLinks(member: TeamMember): SocialLink[] {
  const links: SocialLink[] = [];

  // LinkedIn is intentionally represented by a neutral external-link icon:
  // lucide dropped its brand icons, and the project's own icon set has no
  // LinkedIn mark.
  if (member.githubUrl)
    links.push({ href: member.githubUrl, label: "GitHub", Icon: GithubIcon });
  if (member.linkedinUrl)
    links.push({
      href: member.linkedinUrl,
      label: "LinkedIn",
      Icon: ExternalLinkIcon,
    });
  if (member.portfolioUrl)
    links.push({ href: member.portfolioUrl, label: "Portfolio", Icon: Globe });

  return links;
}

export function TeamDirectory({ groups }: { groups: TeamGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <Card.Content className="p-8 text-center space-y-3">
          <h2 className="text-lg font-semibold">
            Leadership is being published
          </h2>
          <p className="text-sm text-default-500">
            Officers appear here once their profile is marked visible. Members
            can change this from{" "}
            <a
              className="font-medium text-foreground underline underline-offset-4"
              href="/profile"
            >
              profile settings
            </a>
            .
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="space-y-14">
      {groups.map((group) => (
        <section
          key={group.slug}
          aria-labelledby={`designation-${group.slug}`}
          className="space-y-5"
        >
          <div className="flex items-center gap-3">
            <h2
              className="text-xl font-semibold tracking-tight"
              id={`designation-${group.slug}`}
            >
              {group.designation}
            </h2>
            <Chip size="sm" variant="soft">
              {group.members.length}{" "}
              {group.members.length === 1 ? "member" : "members"}
            </Chip>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((member) => {
              const links = socialLinks(member);

              return (
                <li key={member.userId} className="h-full">
                  <Card className="h-full gap-0 transition-shadow hover:shadow-lg">
                    <Card.Header className="gap-4">
                      <Avatar
                        aria-label={`${member.name}'s profile picture`}
                        className="size-14 shrink-0 rounded-2xl"
                      >
                        {member.avatar ? (
                          <Avatar.Image alt="" src={member.avatar} />
                        ) : null}
                        <Avatar.Fallback>{initials(member.name)}</Avatar.Fallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Card.Title className="truncate">
                          {member.name}
                        </Card.Title>
                        <Card.Description className="inline-flex items-center gap-1.5">
                          {group.badgeIcon ? (
                            <DynamicIcon
                              aria-hidden="true"
                              name={group.badgeIcon}
                              className="w-3.5 h-3.5 shrink-0"
                            />
                          ) : null}
                          <span className="truncate">{group.designation}</span>
                        </Card.Description>
                      </div>
                    </Card.Header>

                    {member.bio || member.skills.length > 0 ? (
                      <Card.Content className="space-y-3">
                        {member.bio ? (
                          <p className="text-sm text-default-600 line-clamp-4">
                            {member.bio}
                          </p>
                        ) : null}

                        {member.skills.length > 0 ? (
                          <ul
                            aria-label={`${member.name}'s skills`}
                            className="flex flex-wrap gap-1.5"
                          >
                            {member.skills.slice(0, 5).map((skill) => (
                              <li key={skill}>
                                <Chip size="sm" variant="soft">
                                  {skill}
                                </Chip>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </Card.Content>
                    ) : null}

                    {links.length > 0 ? (
                      <Card.Footer className="mt-auto gap-2 pt-4">
                        {links.map(({ href, label, Icon }) => (
                          <a
                            key={label}
                            aria-label={`${member.name} on ${label} (opens in new tab)`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-default-100 text-default-600 hover:bg-default-200 hover:text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                            href={href}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <Icon aria-hidden="true" className="w-4 h-4" />
                          </a>
                        ))}
                      </Card.Footer>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
