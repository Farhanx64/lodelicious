"use client";

import { motion } from "motion/react";
import { useState } from "react";

export type StoryBlock = {
  key: string;
  /** Rendered on the server: the picture for this block (or its fallback panel). */
  media: React.ReactNode;
  /** Rendered on the server: label, heading, text and link. */
  content: React.ReactNode;
};

/**
 * "What we're known for" on the home page. Desktop: the picture stays put in a sticky left column
 * while the text blocks scroll past on the right, each brightening from 30% as it reaches the
 * middle of the screen, and the picture changes to the block being read. Phones: no sticky
 * column; each block carries its own picture above it. Uses only in-view detection, no scroll maths.
 */
export function StickyStory({ blocks }: { blocks: StoryBlock[] }) {
  const [active, setActive] = useState(0);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-16 lg:grid-cols-2 xl:gap-x-24">
      <div aria-hidden="true" className="sticky top-24 hidden h-[calc(100vh-8rem)] overflow-hidden rounded-[2rem] bg-clay lg:block">
        {blocks.map((block, i) => (
          <div key={block.key} className={`absolute inset-0 transition-opacity duration-700 ${i === active ? "opacity-100" : "opacity-0"}`}>
            {block.media}
          </div>
        ))}
      </div>
      <ol className="flex flex-col gap-16 lg:gap-0">
        {blocks.map((block, i) => (
          <li key={block.key} className="flex flex-col justify-center lg:min-h-[70vh]">
            <div className="mb-6 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-clay lg:hidden">{block.media}</div>
            <motion.div
              className="js-reveal"
              initial={{ opacity: 0.3 }}
              whileInView={{ opacity: 1 }}
              viewport={{ amount: 0.6 }}
              transition={{ duration: 0.5 }}
              onViewportEnter={() => setActive(i)}
            >
              {block.content}
            </motion.div>
          </li>
        ))}
      </ol>
    </div>
  );
}
