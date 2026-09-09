"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";
import { FaGithub, FaInstagram, FaLinkedin } from "react-icons/fa";
import { SiteHeader } from "@/components/layout/SiteHeader";

const teamMembers = [
    {
        id: 1,
        name: "Aarushi Hans",
        role: "Frontend Developer",
        description:
            "A creative and results-driven individual with a keen eye for detail and a passion for building exceptional user experiences.",
        github: "https://github.com/your-github",
        linkedin: "www.linkedin.com/in/aarushi-hans",
        instagram: "https://www.instagram.com/aarushihans_/",
    },
    {
        id: 2,
        name: "Priyanshu Kumar",
        role: "AI Engineer",
        description:
            "A highly motivated and detail-oriented individual with a strong foundation in mathematics and computer science.",
        github: "https://github.com/PriyanshuKumar-CSE",
        linkedin: " https://www.linkedin.com/in/priyanshukumaar",
        instagram: " ",
    },
    {
        id: 3,
        name: "Pratham Sahu",
        role: "Deployment Engineer",
        description:
            "A results-oriented professional with a solid understanding of software engineering principles.",
        github: "https://github.com/prathamsahu31",
        linkedin: "https://linkedin.com/prathamsahu31",
        instagram: " ",
    },
    {
        id: 4,
        name: "Arpita Shokeen",
        role: "Project Member",
        description:
            "Bringing ideas together, refining our vision, and helping shape the project from concept to execution.",
        github: "https://github.com/arpita2shokeen",
        linkedin: "https://www.linkedin.com/in/arpita-shokeen-72968b360?utm_source=share_via&utm_content=profile&utm_medium=member_ios",
        instagram: " ",
    },
    {
        id: 5,
        name: "Kshitij Singhal",
        role: "Project Member",
        description:
            "Helping transform complex ideas into a clear, cohesive vision that drives the project forward.",
        github: "https://github.com/Kshitij-mit",
        linkedin: "https://www.linkedin.com/in/kshitij-singhal-3a1b9028b/",
        instagram: " ",
    },
    {
        id: 6,
        name: "Kinjal Goel",
        role: "Project Member",
        description:
            "Contributing to the research, ideation, and problem-solving that helped turn our concept into a practical solution.",
        github: "https://github.com/kinjalgoel597-byte",
        linkedin: "https://www.linkedin.com/in/kinjal-goel-0526b7381?utm_source=share_via&utm_content=profile&utm_medium=member_android",
        instagram: " ",
    },
];

export default function AboutUsPage() {
    return (
        <div className="relative min-h-screen overflow-hidden text-white" style={{ backgroundImage: "url('/bg1.svg')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>

            {/* Top Right  Glow */}
            <motion.div
                animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="pointer-events-none absolute -top-52 -right-52 h-[700px] w-[700px] rounded-full bg-blue/100 blur-[220px]"
            />

            {/* Bottom Left  Glow */}
            <motion.div
                animate={{ x: [0, -30, 20, 0], y: [0, 30, -20, 0] }}
                transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                className="pointer-events-none absolute -bottom-52 -left-52 h-[600px] w-[600px] rounded-full bg-[#B7D3DF]/40 blur-[220px]"
            />

            {/* Soft vignette */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0, 0, 0, 0.35))]" />

            {/* Page Content */}
            <div className="relative z-10 flex min-h-screen flex-col">
                <SiteHeader />

                <main className="flex-1 flex flex-col items-center justify-center px-4 py-32 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="text-center mb-20"
                    >
                        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 text-[#547491]">
                            Meet the Team
                        </h1>
                        <p className="max-w-2xl mx-auto text-lg text-gray-400">
                            We are a passionate team of builders, designers, and engineers dedicated to revolutionizing the AI and Web3 space.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full mx-auto">
                        {teamMembers.map((member, index) => (
                            <motion.div
                                key={member.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.2 }}
                                className="group relative rounded-2xl bg-white border border-white/10 p-8 backdrop-blur-sm overflow-hidden
                                 flex flex-col items-center text-center transition-all duration-200 hover:bg-white/[0.5] hover:border-white/20 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_0_40px_-10px_rgba(200,182,255,0.15)]
                                 "
                            >

                                <h3 className="text-[#78A4CB] font-semibold text-2xl mb-2">{member.name}</h3>
                                <p className="text-[#898AA6] font-medium mb-4">{member.role}</p>
                                <p className="text-gray-400 text-sm mb-8 leading-relaxed flex-grow">
                                    {member.description}
                                </p>

                                {/* Social Links placeholders */}
                                <div className="flex gap-4 mt-auto opacity-70 group-hover:opacity-100 transition-opacity">
                                    <a
                                        href={member.instagram}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-blue/100 hover:text-blue-300 hover:scale-110 transition-all"
                                    >
                                        <FaInstagram className="w-4 h-4" />
                                    </a>

                                    <a
                                        href={member.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-blue/100 hover:text-blue-300 hover:scale-110 transition-all"
                                    >
                                        <FaLinkedin className="w-4 h-4" />
                                    </a>

                                    <a
                                        href={member.github}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:bg-blue/100 hover:text-blue-300 hover:scale-110 transition-all"
                                    >
                                        <FaGithub className="w-4 h-4" />
                                    </a>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
}