import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { Card } from '../../ui/Card';
import { CardTitle, CardText, StatsGrid, StatItem, TagsGrid, Tag } from '../../ui/Card';
import { CursorGlow } from '../../ui/CursorGlow/CursorGlow';
import styles from './About.module.css';

interface AboutSection {
  title: string;
  description: string;
  stats: {
    value: string;
    label: string;
  }[];
  highlights: string[];
}

interface Education {
  school: string;
  degree: string;
  period: string;
  details: string[];
}

const aboutContent: AboutSection[] = [
  {
    title: "Creative Developer",
    description: "Passionate about crafting innovative digital experiences that push the boundaries of web technology",
    stats: [
      { value: "3+", label: "Years Experience" },
      { value: "50+", label: "Projects" },
      { value: "20+", label: "Happy Clients" }
    ],
    highlights: [
      "Full-stack Development",
      "3D Web Experiences",
      "Modern UI/UX Design"
    ]
  },
  {
    title: "Problem Solver",
    description: "Turning complex challenges into elegant solutions through innovative thinking and technical expertise",
    stats: [
      { value: "100+", label: "Solutions Delivered" },
      { value: "15+", label: "Technologies" },
      { value: "24/7", label: "Dedication" }
    ],
    highlights: [
      "Performance Optimization",
      "Clean Architecture",
      "Technical Leadership"
    ]
  }
];

const educationContent: Education[] = [
  {
    school: "HiLCoE School of Computer Science & Technology",
    degree: "BSc in Computer Science",
    period: "Expected Graduation: August 2025",
    details: [
      "Advanced Programming & Data Structures",
      "Web Development & Cloud Computing",
      "Software Engineering & Design Patterns",
      "Database Management & System Design"
    ]
  },
  {
    school: "Saint Joseph School",
    degree: "High School Diploma",
    period: "2008-2020",
    details: [
      "Advanced Mathematics & Physics",
      "Computer Science Fundamentals",
      "Scientific Research & Projects",
      "Leadership & Team Activities"
    ]
  }
];

export function About() {
  const containerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    damping: 15,
    mass: 0.27,
    stiffness: 55
  });

  const containerY = useTransform(smoothProgress, [0, 1], ["10%", "-10%"]);
  const containerOpacity = useTransform(smoothProgress, [0, 0.2, 0.8, 1], [0.7, 1, 1, 0.7]);
  const headerX = useTransform(smoothProgress, [0, 0.5], ["0%", "10%"]);
  const headerOpacity = useTransform(smoothProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={containerRef} className={styles.about} id="about">
      <CursorGlow />
      <motion.div 
        className={styles.content}
        style={{ 
          y: containerY,
          opacity: containerOpacity
        }}
      >
        <motion.div 
          ref={headerRef}
          className={styles.header}
          style={{
            x: headerX,
            opacity: headerOpacity
          }}
        >
          <h2 className={styles.title}>About Me</h2>
          <p className={styles.subtitle}>
            Crafting digital experiences with passion and precision
          </p>
        </motion.div>

        <div className={styles.aboutGrid}>
          {aboutContent.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ 
                duration: 0.8, 
                ease: [0.76, 0, 0.24, 1],
                delay: 0.2 + (index * 0.1)
              }}
            >
              <Card>
                <div className={styles.cardContent}>
                  <CardTitle>{section.title}</CardTitle>
                  <CardText>{section.description}</CardText>
                  <StatsGrid>
                    {section.stats.map((stat, i) => (
                      <StatItem key={i} value={stat.value} label={stat.label} />
                    ))}
                  </StatsGrid>
                  <TagsGrid>
                    {section.highlights.map((highlight, i) => (
                      <Tag key={i}>{highlight}</Tag>
                    ))}
                  </TagsGrid>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card>
          <div className={styles.cardContent}>
            <CardTitle>Education</CardTitle>
            <div className={styles.educationGrid}>
              {educationContent.map((edu, index) => (
                <motion.div
                  key={edu.school}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ 
                    duration: 0.8, 
                    ease: [0.76, 0, 0.24, 1],
                    delay: 0.2 + (index * 0.1)
                  }}
                >
                  <Card>
                    <div className={styles.cardContent}>
                      <CardTitle>{edu.school}</CardTitle>
                      <div className={styles.educationMeta}>
                        <CardText>{edu.degree}</CardText>
                        <CardText>{edu.period}</CardText>
                      </div>
                      <TagsGrid>
                        {edu.details.map((detail, i) => (
                          <Tag key={i}>{detail}</Tag>
                        ))}
                      </TagsGrid>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>
    </section>
  );
} 