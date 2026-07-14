// Renders a JSON-LD <script> tag for schema.org structured data — used by
// any page that wants rich-result/answer-engine eligibility (Organization,
// FAQPage, Service, etc.) without duplicating the script-tag boilerplate.
export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
