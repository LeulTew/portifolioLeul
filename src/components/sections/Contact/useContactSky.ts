import { useEffect, useState } from 'react';
import {
  getContactView, parkContactSky, releaseContactSky, useContactMode, useContactRevealed,
} from '@/lib/contact/contactScene';
import { registerContactSurface } from '@/lib/contact/contactPresentation';
import { getProjectsView, isProjectsReturnOwed } from '@/lib/projects/projectsScene';
import { subscribeSectionNavigation } from '@/lib/scroll/sectionNavigation';
import { useViewportShareEffect } from '@/lib/scroll/viewportCoverage';

export function useContactSky(section: HTMLElement | null, spatial: boolean) {
  const [instant, setInstant] = useState(false);
  const [hasPresented, setHasPresented] = useState(false);
  const mode = useContactMode();
  const revealed = useContactRevealed();

  useEffect(() => {
    if (revealed) setHasPresented(true);
  }, [revealed]);
  useEffect(() => {
    if (section && spatial) return registerContactSurface(section);
  }, [section, spatial]);

  useViewportShareEffect(spatial ? section : null, share => {
    if (getProjectsView().active) return;
    if (share > 0 && getContactView().mode === 'outside') parkContactSky();
    else if (share === 0 && getContactView().mode === 'parked' && !isProjectsReturnOwed()) releaseContactSky();
  });

  useEffect(() => subscribeSectionNavigation((target, options) => {
    if (options?.source !== 'navbar') return;
    setInstant(target === 'contact');
    if (target === 'contact' && spatial) parkContactSky();
    else releaseContactSky();
  }), [spatial]);

  useEffect(() => {
    if (!spatial) releaseContactSky();
    return releaseContactSky;
  }, [spatial]);

  return { instant: instant || revealed || hasPresented, mode };
}
