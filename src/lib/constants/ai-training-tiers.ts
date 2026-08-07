// lastVerified: 2026-07-29 — Coursera/edX catalogs churn; re-check every
// URL and course title before merging Learning-page UI work on top of
// this file.
//
// Coursera/edX only — deliberately no LinkedIn Learning (unverified
// partner status as of this writing) and no vendor-specific "AI tool"
// courses (those live in function-training.ts / ai-tools-by-function.ts
// instead). Three tiers so the default can be calibrated off
// aiFlexibilityLevel without hiding the other two — all three always
// render as adjacent buttons (2-4 discrete options rule).
import type { LearningResource } from '@/lib/constants/learning-partners'

export type AiTrainingTier = 'foundational' | 'practical' | 'technical'

export const AI_TRAINING_TIER_LABELS: Record<AiTrainingTier, string> = {
  foundational: 'Foundational',
  practical: 'Practical & Business',
  technical: 'Technical',
}

export const AI_TRAINING_COURSES: Record<AiTrainingTier, LearningResource[]> = {
  foundational: [
    {
      title: 'AI For Everyone',
      sponsor: 'DeepLearning.AI',
      description: 'A foundational, non-technical introduction to what AI can and can\'t do.',
      url: 'https://www.coursera.org/learn/ai-for-everyone',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Generative AI for Everyone',
      sponsor: 'DeepLearning.AI',
      description: 'A plain-language overview of generative AI and how it applies across roles.',
      url: 'https://www.coursera.org/learn/generative-ai-for-everyone',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Google AI Essentials',
      sponsor: 'Google',
      description: 'A practical, beginner-friendly course on using AI tools day to day.',
      url: 'https://www.coursera.org/learn/google-ai-essentials',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Google Prompting Essentials',
      sponsor: 'Google',
      description: 'A short, practical course on writing effective prompts for everyday tasks.',
      url: 'https://www.coursera.org/learn/google-prompting-essentials',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Introduction to Generative AI',
      sponsor: 'Google Cloud',
      description: 'A free, short intro to what generative AI is and how it works.',
      url: 'https://www.cloudskillsboost.google/course_templates/536',
      provider: 'coursera',
      free: true,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'AI for Everyone: Master the Basics',
      sponsor: 'IBM',
      description: 'A free-to-audit foundational course on AI concepts and terminology.',
      url: 'https://www.edx.org/learn/artificial-intelligence/ibm-ai-for-everyone-master-the-basics',
      provider: 'edx',
      free: true,
      actionType: 'LEARNING_MODULE',
    },
  ],
  practical: [
    {
      title: 'AI for Business Specialization',
      sponsor: 'Wharton',
      description: 'A specialization on applying AI to real business decisions and strategy.',
      url: 'https://www.coursera.org/specializations/ai-for-business-wharton',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Prompt Engineering for ChatGPT',
      sponsor: 'Vanderbilt',
      description: 'A practical course on getting better, more reliable results from AI chat tools.',
      url: 'https://www.coursera.org/learn/prompt-engineering',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Generative AI for Executives',
      sponsor: 'AWS',
      description: 'A course framing generative AI in terms of business impact and decision-making.',
      url: 'https://www.coursera.org/learn/generative-ai-for-executives',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'AI Product Management Specialization',
      sponsor: 'Duke',
      description: 'A specialization on building and managing AI-powered products.',
      url: 'https://www.coursera.org/specializations/ai-product-management-duke',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Generative AI for HR Professionals',
      sponsor: 'IBM',
      description: 'A course on applying generative AI to HR workflows.',
      url: 'https://www.coursera.org/learn/generative-ai-for-hr-professionals',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Generative AI Fundamentals Professional Certificate',
      sponsor: 'IBM',
      description: 'A professional certificate covering practical generative AI fundamentals.',
      url: 'https://www.edx.org/certificates/professional-certificate/ibm-generative-ai-fundamentals',
      provider: 'edx',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
  ],
  technical: [
    {
      title: 'Machine Learning Specialization',
      sponsor: 'DeepLearning.AI & Stanford',
      description: 'A widely-used specialization on ML fundamentals.',
      url: 'https://www.coursera.org/specializations/machine-learning-introduction',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Deep Learning Specialization',
      sponsor: 'DeepLearning.AI',
      description: 'A specialization on neural networks and deep learning.',
      url: 'https://www.coursera.org/specializations/deep-learning',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'IBM AI Engineering Professional Certificate',
      sponsor: 'IBM',
      description: 'A hands-on professional certificate covering ML and deep learning engineering.',
      url: 'https://www.coursera.org/professional-certificates/ai-engineer',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Python for Everybody',
      sponsor: 'University of Michigan',
      description: 'A beginner-friendly specialization for learning Python from scratch.',
      url: 'https://www.coursera.org/specializations/python',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: "CS50's Introduction to Artificial Intelligence with Python",
      sponsor: 'Harvard',
      description: 'A free-to-audit course on AI concepts and implementation in Python.',
      url: 'https://www.edx.org/learn/artificial-intelligence/harvard-university-cs50-s-introduction-to-artificial-intelligence-with-python',
      provider: 'edx',
      free: true,
      actionType: 'LEARNING_MODULE',
    },
    {
      title: 'Machine Learning with Python',
      sponsor: 'MIT',
      description: 'A course on implementing machine learning models in Python.',
      url: 'https://www.edx.org/learn/machine-learning/massachusetts-institute-of-technology-machine-learning-with-python-from-linear-models-to-deep-learning',
      provider: 'edx',
      free: false,
      actionType: 'LEARNING_MODULE',
    },
  ],
}
