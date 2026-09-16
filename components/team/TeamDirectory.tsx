"use client";

import { Avatar, AvatarImage, AvatarFallback, Button, Card, CardContent, Chip } from "@heroui/react";
import { ExternalLinkIcon, Globe } from "lucide-react";
import { GithubIcon } from "@/components/icons";

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

type SocialLink = { href: string; label: string; Icon: React.FC<{ className?: string }> };

function socialLinks(member: TeamMember): SocialLink[] {
  const links: SocialLink[] = [];
  // LinkedIn is intentionally represented by a neutral external-link icon:
  // lucide dropped its brand icons, and the project's own icon set has no
  // LinkedIn mark.
  if (member.githubUrl) links.push({ href: member.githubUrl, label: `${member.name} on GitHub`, Icon: GithubIcon });
  if (member.linkedinUrl) links.push({ href: member.linkedinUrl, label: `${member.name} on LinkedIn`, Icon: ExternalLinkIcon });
  if (member.portfolioUrl) links.push({ href: member.portfolioUrl, label: `${member.name}'s portfolio`, Icon: Globe });
  return links;
}

export function TeamDirectory({ groups }: { groups: TeamGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center space-y-3">
          <h2 className="text-lg font-semibold">Leadership is being published</h2>
          <p className="text-sm text-default-500">
            Officers are listed here once their profile is marked visible on the public site.
            Members can control this from their profile settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-14">
      {groups.map((group) => (
        <section key={group.slug} aria-labelledby={`designation-${group.slug}`} className="space-y-5">
          <div className="flex items-center gap-3">
            <h2 id={`designation-${group.slug}`} className="text-xl font-semibold tracking-tight">
              {group.designation}
            </h2>
            <span className="text-xs text-default-400">
              {group.members.length} {group.members.length === 1 ? "member" : "members"}
            </span>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((member) => (
              <li key={member.userId}>
                <Card className="h-full">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14 flex-shrink-0">
                        {member.avatar ? <AvatarImage src={member.avatar} alt="" /> : null}
                        <AvatarFallback>{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{member.name}</p>
                        <p className="text-xs text-default-500 truncate">
                          {group.badgeIcon ? `${group.badgeIcon} ` : ""}
                          {group.designation}
                        </p>
                      </div>
                    </div>

                    {member.bio ? (
                      <p className="text-sm text-default-600 line-clamp-4">{member.bio}</p>
                    ) : null}

                    {member.skills.length > 0 ? (
                      <ul className="flex flex-wrap gap-1.5">
                        {member.skills.slice(0, 5).map((skill) => (
                          <li key={skill}>
                            <Chip size="sm" className="text-xs">{skill}</Chip>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {socialLinks(member).length > 0 ? (
                      <div className="flex gap-2 pt-1">
                        {socialLinks(member).map(({ href, label, Icon }) => (
                          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                            <Button isIconOnly size="sm" variant="secondary" aria-label={label}>
                              <Icon className="w-4 h-4" />
                            </Button>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
