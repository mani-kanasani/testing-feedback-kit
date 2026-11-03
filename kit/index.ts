'use client';

// Everything the kit gives your app. Import the styles once, anywhere: import './feedback/feedback.css'.
export { FeedbackPage, parsePath, type FeedbackPageProps } from './FeedbackPage';
export { FeedbackButton, type FeedbackButtonProps } from './FeedbackButton';
export { FeedbackBell, type FeedbackBellProps } from './FeedbackBell';
export { createLocalApi, emptyState, seedTicket, type LocalState } from './local';
export { FEEDBACK_CHANGED, type FeedbackApi } from './api';
export { useHashPath } from './hash';
export * from './model';
// createSupabaseApi is imported from './supabase' on its own, so an app on another backend never loads it.
