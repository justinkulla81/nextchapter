// lastVerified: 2026-07-29 — certification bodies rename/restructure their
// programs occasionally; re-check every URL before merging Learning-page
// UI work on top of this file.
//
// One entry per PRIMARY_FUNCTION_OPTIONS value with real, substantive
// certification content. 'General' and 'Other' have no dedicated entry —
// there's no real function-specific certification universe for either, so
// they fall through to the page's generic fallback rather than being
// padded with filler.
import type { LearningResource } from '@/lib/constants/learning-partners'
import type { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

type Function = (typeof PRIMARY_FUNCTION_OPTIONS)[number]

export const CERTIFICATIONS_BY_FUNCTION: Partial<Record<Function, LearningResource[]>> = {
  Operations: [
    {
      title: 'Project Management Professional (PMP)',
      description: 'The most widely recognized project-management certification across industries.',
      url: 'https://www.pmi.org/certifications/project-management-pmp',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'Lean Six Sigma Green Belt',
      description: 'Process-improvement methodology recognized in manufacturing, healthcare, and operations broadly.',
      url: 'https://www.coursera.org/professional-certificates/lean-six-sigma-green-belt',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'CPIM (Certified in Planning and Inventory Management)',
      description: 'APICS/ASCM\'s supply-chain and operations-planning certification.',
      url: 'https://www.ascm.org/certifications/cpim/',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  Finance: [
    {
      title: 'CPA (Certified Public Accountant)',
      description: 'The standard credential for accounting and financial-reporting roles in the US.',
      url: 'https://www.aicpa-cima.com/becomeacpa',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'CFA (Chartered Financial Analyst)',
      description: 'The gold-standard credential for investment and financial-analysis roles.',
      url: 'https://www.cfainstitute.org/programs/cfa-program',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'CMA (Certified Management Accountant)',
      description: 'Focused on management accounting and financial strategy, distinct from public-accounting CPA work.',
      url: 'https://www.imanet.org/cma-certification',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  Sales: [
    {
      title: 'Salesforce Administrator Certification',
      description: 'The standard credential for Salesforce platform administration — widely required in sales-ops job postings.',
      url: 'https://trailhead.salesforce.com/credentials/administrator',
      provider: 'certificationBody',
      free: true,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'Sales Development Representative Professional Certificate',
      description: 'A practical certificate covering the SDR/BDR pipeline-generation skill set.',
      url: 'https://www.coursera.org/professional-certificates/salesforce-sales-development-representative',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  Engineering: [
    {
      title: 'AWS Certified Solutions Architect',
      description: 'The most widely requested cloud-architecture certification in engineering job postings.',
      url: 'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'Microsoft Certified: Azure Administrator (AZ-104)',
      description: 'The standard Azure administration credential for engineers working in Microsoft-stack environments.',
      url: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-administrator/',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'Certified Kubernetes Administrator (CKA)',
      description: 'The recognized credential for Kubernetes/container-orchestration expertise.',
      url: 'https://www.cncf.io/training/certification/cka/',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  'Human Resources': [
    {
      title: 'SHRM-CP (Society for Human Resource Management Certified Professional)',
      description: 'The most widely recognized generalist HR certification in the US.',
      url: 'https://www.shrm.org/credentials/certification',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'PHR (Professional in Human Resources)',
      description: "HRCI's foundational HR-generalist certification, commonly requested alongside SHRM-CP.",
      url: 'https://www.hrci.org/our-programs/our-certifications/phr',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  Legal: [
    {
      title: 'CIPP/US (Certified Information Privacy Professional)',
      description: 'The standard privacy-law certification, increasingly requested for in-house counsel and compliance roles.',
      url: 'https://iapp.org/certify/cippus/',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'CCEP (Certified Compliance and Ethics Professional)',
      description: 'A widely recognized credential for corporate compliance roles.',
      url: 'https://www.corporatecompliance.org/certification/ccep',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  'Data & Analytics': [
    {
      title: 'Google Data Analytics Certificate',
      description: 'A widely recognized, practical entry point into data-analytics tooling and workflows.',
      url: 'https://www.coursera.org/professional-certificates/google-data-analytics',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
    {
      title: 'Microsoft Certified: Power BI Data Analyst Associate (PL-300)',
      description: 'The standard BI-tooling certification for analysts working in Microsoft-stack environments.',
      url: 'https://learn.microsoft.com/en-us/credentials/certifications/power-bi-data-analyst-associate/',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  'Customer Success': [
    {
      title: 'Customer Success Manager Certification (Success Coaching)',
      description: 'A widely used practical certification covering the CSM playbook (onboarding, renewals, expansion).',
      url: 'https://www.successcoaching.co/certifications/certified-customer-success-manager',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  Design: [
    {
      title: 'Google UX Design Professional Certificate',
      description: "The most widely recognized entry-level UX certification, built around a portfolio-ready capstone.",
      url: 'https://www.coursera.org/professional-certificates/google-ux-design',
      provider: 'coursera',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  Administration: [
    {
      title: 'Certified Administrative Professional (CAP)',
      description: 'A recognized generalist credential for administrative and executive-support roles.',
      url: 'https://www.iaap-hq.org/page/cap',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
  'Executive Leadership': [
    {
      title: 'NACD Directorship Certification',
      description: "The recognized board-governance credential — most of the genuinely substantive executive-leadership certification universe.",
      url: 'https://www.nacdonline.org/education/directorship-certification/',
      provider: 'certificationBody',
      free: false,
      actionType: 'LEARNING_CERTIFICATE',
    },
  ],
}
