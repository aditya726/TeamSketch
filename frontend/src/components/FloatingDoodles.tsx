import { motion } from "framer-motion";
import { Pencil, Square, Circle, Triangle, MousePointer2, Type, Eraser } from "lucide-react";

// Generate random positions for each doodle
const generateRandomPosition = () => ({
  x: Math.random() * 80 + 10, // 10% to 90%
  y: Math.random() * 80 + 10, // 10% to 90%
});

const icons = [Pencil, Square, Circle, Triangle, MousePointer2, Type, Eraser];
const colors = [
  "text-blue-500",
  "text-red-500", 
  "text-green-500",
  "text-yellow-500",
  "text-purple-500",
  "text-orange-500",
  "text-pink-500"
];

const doodles = icons.map((icon, index) => {
  const pos = generateRandomPosition();
  return {
    icon,
    color: colors[index],
    size: Math.random() * 25 + 45, // 45-70px (larger)
    x: `${pos.x}%`,
    y: `${pos.y}%`,
    delay: Math.random() * 2,
  };
});

export const FloatingDoodles = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-70">
      {doodles.map((doodle, index) => {
        const Icon = doodle.icon;
        return (
          <motion.div
            key={index}
            className={`absolute ${doodle.color}`}
            style={{ left: doodle.x, top: doodle.y }}
            initial={{ opacity: 0, rotate: 0, scale: 0 }}
            animate={{
              y: [-20, 0, -20],
              rotate: [0, 10, -10, 0],
              opacity: 0.8,
              scale: 1,
            }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: doodle.delay,
              ease: "easeInOut",
            }}
          >
            <Icon size={doodle.size} strokeWidth={2} />
          </motion.div>
        );
      })}
      
      {/* Hand-drawn lines */}
      <svg className="absolute inset-0 w-full h-full">
        <motion.path
          d="M 100 100 Q 150 50 200 100"
          fill="none"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
        />
        <motion.path
          d="M 800 600 Q 850 650 900 600"
          fill="none"
          stroke="rgba(0,0,0,0.15)"
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 1 }}
        />
      </svg>
    </div>
  );
};