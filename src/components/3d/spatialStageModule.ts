/**
 * Loads the spatial page on demand. Its own module so a test can hand React a
 * module that is already resolved, rather than suspending every render.
 */
export const loadSpatialStage = () => import('./SpatialStage');
