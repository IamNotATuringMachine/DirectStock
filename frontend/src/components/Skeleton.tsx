import React from "react";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export function Skeleton({ className = "", width, height, circle }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width,
    height: height,
    borderRadius: circle ? "50%" : "var(--radius-sm)",
  };

  return (
    <div
      className={`skeleton-pulse ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
