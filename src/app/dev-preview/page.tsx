import Link from 'next/link'

export default function Index() {
  return (
    <ul className="list-disc pl-6">
      <li>
        <Link href="/dev-preview/jobs">Find a job</Link>
      </li>
    </ul>
  )
}
