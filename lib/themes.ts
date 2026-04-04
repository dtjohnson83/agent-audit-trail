export type Theme = ThemeColors
export type ThemeColors = {
  bg: string
  surface: string
  surfaceHover: string
  surfaceSolid: string
  border: string
  borderActive: string
  text: string
  textSecondary: string
  textMuted: string
  textGhost: string
  accent: string
  accentBg: string
  accentBorder: string
  cardBg: string
  codeBg: string
  codeBorder: string
  floatBg: string
  grain: number
  glowOpacity: number
  critical: string
  high: string
  medium: string
  success: string
  error: string
  flagged: string
  costColor: string
}

export const themes: Record<'dark' | 'light', ThemeColors> = {
  dark: {
    bg: '#030306',
    surface: 'rgba(255,255,255,0.02)',
    surfaceHover: 'rgba(255,255,255,0.04)',
    surfaceSolid: 'rgba(3,3,6,0.85)',
    border: 'rgba(255,255,255,0.04)',
    borderActive: 'rgba(0,245,212,0.2)',
    text: '#f4f4f5',
    textSecondary: '#71717a',
    textMuted: '#3f3f46',
    textGhost: '#27272a',
    accent: '#00f5d4',
    accentBg: 'rgba(0,245,212,0.08)',
    accentBorder: 'rgba(0,245,212,0.15)',
    cardBg: 'rgba(255,255,255,0.015)',
    codeBg: 'rgba(0,0,0,0.4)',
    codeBorder: 'rgba(255,255,255,0.03)',
    floatBg: 'rgba(10,10,15,0.85)',
    grain: 0.018,
    glowOpacity: 1,
    critical: '#ff3b5c',
    high: '#ff9f1c',
    medium: '#4cc9f0',
    success: '#00f5d4',
    error: '#ff3b5c',
    flagged: '#ff9f1c',
    costColor: '#b794f6',
  },
  light: {
    bg: '#f8f9fc',
    surface: 'rgba(0,0,0,0.02)',
    surfaceHover: 'rgba(0,0,0,0.04)',
    surfaceSolid: 'rgba(248,249,252,0.9)',
    border: 'rgba(0,0,0,0.06)',
    borderActive: 'rgba(0,140,120,0.25)',
    text: '#111118',
    textSecondary: '#5a5a6e',
    textMuted: '#8a8a9a',
    textGhost: '#b0b0be',
    accent: '#0a9b80',
    accentBg: 'rgba(10,155,128,0.06)',
    accentBorder: 'rgba(10,155,128,0.15)',
    cardBg: 'rgba(255,255,255,0.7)',
    codeBg: 'rgba(0,0,0,0.03)',
    codeBorder: 'rgba(0,0,0,0.06)',
    floatBg: 'rgba(255,255,255,0.9)',
    grain: 0,
    glowOpacity: 0.4,
    critical: '#dc2626',
    high: '#d97706',
    medium: '#2563eb',
    success: '#059669',
    error: '#dc2626',
    flagged: '#d97706',
    costColor: '#7c3aed',
  },
}
