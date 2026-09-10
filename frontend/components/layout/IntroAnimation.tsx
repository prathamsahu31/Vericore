"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
    onFinish: () => void;
}

export default function IntroAnimation({ onFinish }: Props) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onFinish();
        }, 2600);

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[url('/bg3.svg')] bg-cover bg-center"
            initial={{ opacity: 1 }}
            animate={{
                opacity: [1, 1, 0],
            }}
            transition={{
                duration: 4,
                times: [0, 0.8, 1],
            }}
        >
            <motion.div
                className="flex items-center"
                animate={{
                    y: [0, 0, -20],
                    opacity: [1, 1, 0],
                }}
                transition={{
                    duration: 2.4,
                    times: [0, 0.8, 1],
                }}
            >
                {/* Logo */}

                <motion.div
                    initial={{
                        opacity: 0,
                        scale: 0.8,
                        rotate: -10,
                    }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        rotate: 0,
                    }}
                    transition={{
                        duration: 1,
                    }}
                >
                    <Image
                        src="/robot_hi.png"
                        alt="Vericore"
                        width={56}
                        height={56}
                    />
                </motion.div>

                {/* Text */}

                <motion.div
                    className="overflow-hidden"
                    initial={{ width: 0 }}
                    animate={{ width: 190 }}
                    transition={{
                        delay: 0.8,
                        duration: 1.5,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                >
                    <h1 className="ml-4 whitespace-nowrap text-4xl font-semibold text-navy-blue tracking-tight">
                        Vericore
                    </h1>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}