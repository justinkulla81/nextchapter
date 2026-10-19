// Preview pages with no navigation: what a person outside the dashboard sees, such as a supporter.
export default function BareLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-candidate min-h-screen bg-white">{children}</div>
}
