import { Card, CardBody } from "@heroui/card";
import { Avatar, AvatarGroup } from "@heroui/avatar";
import { Chip } from "@heroui/chip";
import { title, subtitle } from "@/components/primitives";

export default function AboutPage() {
  const stats = [
    { label: "Active Members", value: "500+", color: "primary" },
    { label: "Events Hosted", value: "50+", color: "secondary" },
    { label: "Projects Built", value: "100+", color: "success" },
    { label: "Years Running", value: "3+", color: "warning" },
  ];

  const values = [
    {
      icon: "💡",
      title: "Innovation",
      description: "We foster creativity and encourage thinking outside the box",
    },
    {
      icon: "🤝",
      title: "Collaboration",
      description: "Building connections and working together to achieve more",
    },
    {
      icon: "🚀",
      title: "Growth",
      description: "Continuous learning and development for all members",
    },
    {
      icon: "🌟",
      title: "Excellence",
      description: "Striving for quality in everything we create",
    },
  ];

  const teamMembers = [
    "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    "https://i.pravatar.cc/150?u=a04258a2462d826712d",
    "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    "https://i.pravatar.cc/150?u=a04258114e29026302d",
    "https://i.pravatar.cc/150?u=a04258114e29026708c",
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <div className="text-center space-y-4 relative">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-700" />
        
        <div className="relative z-10">
          <h1 className={title({ size: "lg" })}>
            About{" "}
            <span className={title({ color: "violet", size: "lg" })}>
              Mind Mesh
            </span>
          </h1>
          <p className={subtitle({ class: "mt-4 max-w-2xl mx-auto" })}>
            A community where ideas connect, creativity flourishes, and innovation thrives
          </p>
        </div>
      </div>


      {/* Story Section */}
      <Card className="border-none bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30" shadow="lg">
        <CardBody className="p-8 md:p-12">
          <h2 className={title({ size: "sm" })}>Our Story</h2>
          <p className="text-default-600 mt-4 text-lg leading-relaxed">
            Mind Mesh was founded with a simple yet powerful vision: to create a space where 
            passionate individuals could come together, share ideas, and build something extraordinary. 
            What started as a small group of friends has grown into a thriving community of innovators, 
            creators, and dreamers.
          </p>
          <p className="text-default-600 mt-4 text-lg leading-relaxed">
            We believe that the best ideas emerge when diverse minds collaborate. Our club brings 
            together students from various backgrounds, each contributing their unique perspective 
            to create something greater than the sum of its parts.
          </p>
        </CardBody>
      </Card>

      {/* Values Grid */}
      <div>
        <h2 className={title({ size: "sm", class: "text-center mb-8" })}>
          Our Values
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {values.map((value, index) => (
            <Card
              key={index}
              className="border-none hover:scale-105 transition-all duration-300 hover:shadow-xl"
              shadow="sm"
            >
              <CardBody className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{value.icon}</div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                    <p className="text-default-600">{value.description}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Team Section */}
      <Card className="border-none bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/30 dark:to-pink-950/30" shadow="lg">
        <CardBody className="p-8 text-center">
          <h2 className={title({ size: "sm", class: "mb-4" })}>Meet Our Team</h2>
          <p className="text-default-600 mb-6">
            Passionate leaders driving innovation and growth
          </p>
          <div className="flex justify-center">
            <AvatarGroup isBordered max={5} size="lg">
              {teamMembers.map((avatar, index) => (
                <Avatar key={index} src={avatar} />
              ))}
            </AvatarGroup>
          </div>
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            <Chip color="primary" variant="flat">Leadership</Chip>
            <Chip color="secondary" variant="flat">Innovation</Chip>
            <Chip color="success" variant="flat">Creativity</Chip>
            <Chip color="warning" variant="flat">Excellence</Chip>
          </div>
        </CardBody>
      </Card>

     
    </div>
  );
}