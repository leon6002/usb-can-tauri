export const radToDegree = (rad: number): number => {
  return (rad * 180) / Math.PI;
};

export const degreeToRad = (degree: number): number => {
  return (degree * Math.PI) / 180;
};
