import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getWatchlistWithCounts, getWatchlistPostings } from '@/lib/company-tracker/watchlist'
import { isRecentlyListed } from '@/lib/jobs/fit-bucket-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CompanyWatchlistForm } from '@/components/dashboard/CompanyWatchlistForm'
import { CompanyWatchlistList, WatchlistPostingsList } from '@/components/dashboard/CompanyWatchlistList'
import { MarkWatchlistViewedOnMount } from '@/components/dashboard/MarkWatchlistViewedOnMount'

export default async function CompanyTrackerPage() {
  const profile = await getDashboardData()

  const [companies, postings] = await Promise.all([
    getWatchlistWithCounts(profile.id),
    getWatchlistPostings(profile.id),
  ])

  return (
    <div className="space-y-6">
      <MarkWatchlistViewedOnMount />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Company Tracker</h1>
        <p className="text-muted-foreground">
          Name the 15–30 companies you&apos;d actually want to work for and watch for openings there, instead of
          only reacting to what&apos;s already posted — the same account-based approach executive search firms use.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a company</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyWatchlistForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your watchlist ({companies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyWatchlistList companies={companies} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open postings from watched companies</CardTitle>
        </CardHeader>
        <CardContent>
          <WatchlistPostingsList
            postings={postings.map((p) => ({
              id: p.id,
              title: p.title,
              companyName: p.companyName,
              location: p.location,
              url: p.url,
              isNew: isRecentlyListed(p.createdAt),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
