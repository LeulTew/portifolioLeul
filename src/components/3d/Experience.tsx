import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { HomeScene } from '../sections/Home/HomeScene';
import { AboutScene } from '../sections/About/AboutScene';
import { SkillsScene } from '../sections/Skills/SkillsScene';
import { ProjectsScene } from '../sections/Projects/ProjectsScene';
import { ContactScene } from '../sections/Contact/ContactScene';

interface ExperienceProps {
  section: string;
  activeProject: number | null;
  isProjectHovered: boolean;
}

export function Experience({ section, activeProject, isProjectHovered }: ExperienceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderScene = () => {
    switch (section) {
      case 'home':
        return <HomeScene />;
      case 'about':
        return <AboutScene />;
      case 'skills':
        return <SkillsScene />;
      case 'projects':
        return <ProjectsScene activeProject={activeProject} isHovered={isProjectHovered} />;
      case 'contact':
        return <ContactScene />;
      default:
        return <HomeScene />;
    }
  };

  return (
    <Canvas
      ref={canvasRef}
      dpr={[1, 2]}
      camera={{ position: [0, 0, 10], fov: 50, near: 0.01, far: 1000 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: false,
      }}
    >
      {renderScene()}
    </Canvas>
  );
}