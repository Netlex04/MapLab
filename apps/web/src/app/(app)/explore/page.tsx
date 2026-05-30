import { getPublicProjects, getExploreFilterOptions } from '@/app/actions/community'
import { ExploreClient } from './ExploreClient'

export default async function ExplorePage() {
  const [projects, filterOptions] = await Promise.all([
    getPublicProjects({ sort: 'newest' }),
    getExploreFilterOptions(),
  ])

  return (
    <ExploreClient
      initialProjects={projects}
      ecuTypes={filterOptions.ecuTypes}
      stages={filterOptions.stages}
      fuelTypes={filterOptions.fuelTypes}
    />
  )
}
